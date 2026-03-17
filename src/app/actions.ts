'use server';

import { z } from 'zod';
import nodemailer from 'nodemailer';
import { JSDOM } from 'jsdom';
import {
  collection,
  writeBatch,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/index-server';
import { headers } from 'next/headers';
import { setAuthCookie, clearAuthCookie, type SessionPermissions } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import type { AccessKey } from '@/lib/data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getClientIp(): Promise<string> {
  const headersList = await headers();
  return (
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    'unknown'
  );
}

/** Returns the master key value — from env var (most secure, never touches Firestore). */
function getMasterKeyFromEnv(): string | undefined {
  return process.env.MASTER_KEY || undefined;
}

// ─── Authentication Actions ────────────────────────────────────────────────────

/**
 * Validates an access key entirely server-side.
 * Master key is checked against the MASTER_KEY environment variable.
 * Custom keys are validated against the Firestore accessKeys collection.
 * Sets an HTTP-only signed cookie on success.
 */
export async function loginWithKey(
  key: string
): Promise<{ success: boolean; message: string; permissions?: SessionPermissions }> {
  const ip = await getClientIp();
  const rl = checkRateLimit(`login:${ip}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);

  if (!rl.allowed) {
    const seconds = Math.ceil(rl.retryAfterMs / 1000);
    return {
      success: false,
      message: `Too many login attempts. Try again in ${seconds} seconds.`,
    };
  }

  const trimmedKey = key?.trim();
  if (!trimmedKey) {
    return { success: false, message: 'Access key cannot be empty.' };
  }

  // ── 1. Check master key (env var — no Firestore needed, no auth needed) ──
  const masterKey = getMasterKeyFromEnv();
  if (masterKey && trimmedKey === masterKey) {
    const permissions: SessionPermissions = {
      isMaster: true,
      pages: [],
      tagName: 'Master Key',
    };
    await setAuthCookie(permissions);
    return { success: true, message: 'Login successful.', permissions };
  }

  // ── 2. Check Firestore accessKeys collection ───────────────────────────────
  // accessKeys has `allow read: if true` so no auth token is needed here.
  try {
    const { firestore } = await initializeFirebase();
    const keysCollection = collection(firestore, 'accessKeys');
    const q = query(keysCollection, where('key', '==', trimmedKey));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const keyData = querySnapshot.docs[0].data() as AccessKey;
      const permissions: SessionPermissions = {
        isMaster: keyData.isMasterKey || false,
        pages: keyData.permissions || [],
        tagName: keyData.tagName || 'Unknown',
      };
      await setAuthCookie(permissions);
      return { success: true, message: 'Login successful.', permissions };
    }
  } catch (error) {
    console.error('loginWithKey — Firestore error:', error);
    return { success: false, message: 'A server error occurred. Please try again.' };
  }

  return { success: false, message: 'Invalid access key.' };
}

/**
 * Clears the session cookie (logout).
 */
export async function logoutAction(): Promise<void> {
  await clearAuthCookie();
}

/**
 * Verifies a key is a valid master key (env var) or a Firestore master access key.
 * Used for gating the Access Keys management page.
 */
export async function verifyMasterKey(
  key: string
): Promise<{ success: boolean; message: string }> {
  const ip = await getClientIp();
  const rl = checkRateLimit(
    `master-verify:${ip}`,
    RATE_LIMITS.masterKeyOps.limit,
    RATE_LIMITS.masterKeyOps.windowMs
  );
  if (!rl.allowed) {
    const seconds = Math.ceil(rl.retryAfterMs / 1000);
    return { success: false, message: `Too many attempts. Try again in ${seconds} seconds.` };
  }

  const trimmedKey = key?.trim();
  if (!trimmedKey) return { success: false, message: 'Key cannot be empty.' };

  // Check env var master key
  const masterKey = getMasterKeyFromEnv();
  if (masterKey && trimmedKey === masterKey) {
    return { success: true, message: 'Key verified.' };
  }

  // Check Firestore master access keys
  try {
    const { firestore } = await initializeFirebase();
    const keysCollection = collection(firestore, 'accessKeys');
    const q = query(
      keysCollection,
      where('key', '==', trimmedKey),
      where('isMasterKey', '==', true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { success: true, message: 'Key verified.' };
    }
  } catch (error) {
    console.error('verifyMasterKey — Firestore error:', error);
    return { success: false, message: 'A server error occurred.' };
  }

  return { success: false, message: 'Invalid or non-master key.' };
}

/**
 * Changes the MASTER_KEY — since this is an env var, this action returns
 * instructions rather than attempting a live update. The key is also stored
 * in Firestore for reference (does not impact server-side validation).
 */
export async function updateMasterKey(
  currentKey: string,
  newKey: string
): Promise<{ success: boolean; message: string }> {
  const verification = await verifyMasterKey(currentKey);
  if (!verification.success) {
    return { success: false, message: 'Current master key is incorrect.' };
  }

  const trimmedNew = newKey?.trim();
  if (!trimmedNew || trimmedNew.length < 6) {
    return { success: false, message: 'New key must be at least 6 characters.' };
  }

  // Note: env var can't be updated at runtime. Store in Firestore for reference.
  try {
    const { firestore } = await initializeFirebase();
    const ref = doc(firestore, 'systemConfig', 'masterKeyRecord');
    await setDoc(ref, {
      requestedKey: '*** (see MASTER_KEY env var)',
      updatedAt: new Date().toISOString(),
      note: 'Update the MASTER_KEY environment variable and redeploy to apply changes.',
    });
  } catch {
    // Best-effort — not critical
  }

  return {
    success: true,
    message:
      'To change the master key, update the MASTER_KEY variable in your hosting environment and redeploy. ' +
      'In Firebase App Hosting, go to: Firebase Console → App Hosting → Backend → Environment Variables.',
  };
}

// ─── Email Receipt ─────────────────────────────────────────────────────────────

const sendReceiptSchema = z.object({
  email: z.string().email(),
  receiptHtml: z.string().max(50_000, 'Receipt content too large.'),
});

function createProfessionalEmailHtml(receiptContent: string): string {
  const dom = new JSDOM(receiptContent);
  const document = dom.window.document;
  const getText = (selector: string) =>
    document.querySelector(selector)?.textContent?.trim() || '';

  const transactionId = getText('[data-transaction-id]');
  const dateShort = getText('[data-date-short]');
  const time = getText('[data-time]');
  const total = getText('[data-total]');
  const subtotal = getText('[data-subtotal]');
  const tax = getText('[data-tax]');
  const couponCode = getText('[data-coupon-code]');
  const discount = getText('[data-discount]');

  const items = Array.from(document.querySelectorAll('tbody > tr'))
    .map((row) => {
      const cells = (row as Element).querySelectorAll('td');
      if (cells.length < 4) return '';
      const [item, qty, price, amount] = Array.from(cells).map(
        (c) => (c as Element).textContent?.trim() || ''
      );
      return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e9ecef;">${item}</td>
        <td style="padding:10px;border-bottom:1px solid #e9ecef;text-align:right;">${qty}</td>
        <td style="padding:10px;border-bottom:1px solid #e9ecef;text-align:right;">${price}</td>
        <td style="padding:10px;border-bottom:1px solid #e9ecef;text-align:right;">${amount}</td>
      </tr>`;
    })
    .join('');

  const discountRow = couponCode
    ? `<div style="color:#28a745;">Discount (${couponCode}): <span>-$${discount}</span></div>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Your Receipt from UrbanPOS</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f8f9fa;color:#212529;}
      .ec{max-width:600px;margin:40px auto;background:#fff;border:1px solid #e9ecef;border-radius:8px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.06);}
      .eh{background:#1A237E;color:#fff;padding:24px;text-align:center;}.eh h1{margin:0;font-size:28px;color:#fff;}
      .eb{padding:24px;}.st{font-size:16px;font-weight:600;color:#495057;border-bottom:2px solid #dee2e6;padding-bottom:8px;margin-bottom:16px;}
      .sg{display:grid;grid-template-columns:1fr 1fr;gap:16px;}.si{background:#f8f9fa;padding:12px;border-radius:6px;}
      .sil{font-size:14px;color:#6c757d;margin:0 0 4px;}.siv{font-size:16px;font-weight:600;margin:0;}
      .it{width:100%;border-collapse:collapse;}.it th,.it td{text-align:left;padding:12px;border-bottom:1px solid #e9ecef;}
      .it th{font-size:14px;font-weight:600;color:#495057;}.it td{font-size:14px;}
      .ts{text-align:right;margin-top:24px;padding-top:16px;border-top:2px solid #dee2e6;}
      .ti{margin-bottom:8px;font-size:15px;}.ti span{display:inline-block;min-width:100px;text-align:right;}
      .tf{font-size:22px;font-weight:700;color:#1A237E;margin-top:12px;}
      .ef{background:#f1f3f5;padding:20px;text-align:center;font-size:12px;color:#6c757d;}
    </style></head><body>
    <div class="ec">
      <div class="eh"><h1>Your Receipt</h1></div>
      <div class="eb">
        <div><div class="st">Sale Summary</div>
          <div class="sg">
            <div class="si"><p class="sil">Transaction ID</p><p class="siv">${transactionId}</p></div>
            <div class="si"><p class="sil">Date &amp; Time</p><p class="siv">${dateShort} ${time}</p></div>
          </div>
        </div>
        <div style="margin-top:24px;"><div class="st">Item Details</div>
          <table class="it"><thead><tr><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>${items}</tbody></table>
        </div>
        <div class="ts">
          <div class="ti">Subtotal: <span>$${subtotal}</span></div>
          ${discountRow}
          <div class="ti">Tax: <span>$${tax}</span></div>
          <div class="tf">Total Paid: <span>$${total}</span></div>
        </div>
      </div>
      <div class="ef"><p>Thank you for your business!</p><p>UrbanPOS &copy; ${new Date().getFullYear()}</p></div>
    </div></body></html>`;
}

export async function sendEmailReceipt(
  values: z.infer<typeof sendReceiptSchema>
): Promise<{ success: boolean; message: string }> {
  const ip = await getClientIp();
  const rl = checkRateLimit(`email:${ip}`, RATE_LIMITS.emailReceipt.limit, RATE_LIMITS.emailReceipt.windowMs);
  if (!rl.allowed) {
    const seconds = Math.ceil(rl.retryAfterMs / 1000);
    return { success: false, message: `Too many email requests. Try again in ${seconds}s.` };
  }

  const validatedFields = sendReceiptSchema.safeParse(values);
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input. Please provide a valid email.' };
  }

  const { email, receiptHtml } = validatedFields.data;
  const professionalHtml = createProfessionalEmailHtml(receiptHtml);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `UrbanPOS <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: 'Your Receipt from UrbanPOS',
      html: professionalHtml,
    });
    return { success: true, message: `Receipt sent to ${email}` };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, message: 'Failed to send receipt. Check SMTP configuration.' };
  }
}

// ─── Exchange Rates ────────────────────────────────────────────────────────────

export async function syncExchangeRates(): Promise<{ success: boolean; message: string }> {
  const ip = await getClientIp();
  const rl = checkRateLimit(`sync:${ip}`, RATE_LIMITS.exchangeSync.limit, RATE_LIMITS.exchangeSync.windowMs);
  if (!rl.allowed) {
    const seconds = Math.ceil(rl.retryAfterMs / 1000);
    return { success: false, message: `Already synced recently. Try again in ${seconds}s.` };
  }

  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) return { success: false, message: 'Open Exchange Rates App ID is not configured.' };

  try {
    const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${appId}&base=USD`);
    if (!response.ok) throw new Error(`API call failed: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`API error: ${data.description}`);

    const rates = data.rates;
    const lastUpdated = new Date().toISOString();

    const { firestore } = await initializeFirebase();
    const batch = writeBatch(firestore);
    const ratesCollection = collection(firestore, 'exchangeRates');

    for (const currencyCode in rates) {
      batch.set(doc(ratesCollection, currencyCode), { code: currencyCode, rate: rates[currencyCode], lastUpdated });
    }
    batch.set(doc(firestore, 'settings', 'store-settings'), { lastCurrencySync: lastUpdated }, { merge: true });
    await batch.commit();

    return { success: true, message: `Successfully synced ${Object.keys(rates).length} exchange rates.` };
  } catch (error) {
    console.error('Error syncing exchange rates:', error);
    return { success: false, message: `Failed to sync: ${error instanceof Error ? error.message : 'Unknown error.'}` };
  }
}
