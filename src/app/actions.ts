'use server';

import { z } from 'zod';
import nodemailer from 'nodemailer';
import { JSDOM } from 'jsdom';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/index-server';


const sendReceiptSchema = z.object({
  email: z.string().email(),
  receiptHtml: z.string(),
});

function createProfessionalEmailHtml(receiptContent: string): string {
  const dom = new JSDOM(receiptContent);
  const doc = dom.window.document;

  const getText = (selector: string) => doc.querySelector(selector)?.textContent?.trim() || '';
  const getHtml = (selector: string) => doc.querySelector(selector)?.innerHTML || '';


  const transactionId = getText('[data-transaction-id]');
  const dateShort = getText('[data-date-short]');
  const time = getText('[data-time]');
  const total = getText('[data-total]');
  const subtotal = getText('[data-subtotal]');
  const tax = getText('[data-tax]');
  
  const couponCode = getText('[data-coupon-code]');
  const discount = getText('[data-discount]');

  const items = Array.from(doc.querySelectorAll('tbody > tr')).map(row => {
    const cells = row.querySelectorAll('td');
    if(cells.length < 4) return '';
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">${cells[0].textContent}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: right;">${cells[1].textContent}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: right;">${cells[2].textContent}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: right;">${cells[3].textContent}</td>
      </tr>
    `;
  }).join('');
  
  const discountRow = couponCode ? `
    <div class="totals-item" style="color: #28a745;">
      Discount (${couponCode}): <span>-$${discount}</span>
    </div>
  ` : '';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Receipt from UrbanPOS</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; color: #212529; }
        .email-container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,.06); }
        .email-header { background-color: #1A237E; color: #ffffff; padding: 24px; text-align: center; }
        .email-header h1 { margin: 0; font-size: 28px; color: #ffffff; }
        .email-body { padding: 24px; }
        .section { margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 8px; margin-bottom: 16px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .summary-item { background-color: #f8f9fa; padding: 12px; border-radius: 6px; }
        .summary-item-label { font-size: 14px; color: #6c757d; margin: 0 0 4px; }
        .summary-item-value { font-size: 16px; font-weight: 600; margin: 0; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th, .items-table td { text-align: left; padding: 12px; border-bottom: 1px solid #e9ecef; }
        .items-table th { font-size: 14px; font-weight: 600; color: #495057; }
        .items-table td { font-size: 14px; }
        .totals-section { text-align: right; margin-top: 24px; padding-top: 16px; border-top: 2px solid #dee2e6; }
        .totals-item { margin-bottom: 8px; font-size: 15px; }
        .totals-item span { display: inline-block; min-width: 100px; text-align: right; }
        .total-final { font-size: 22px; font-weight: 700; color: #1A237E; margin-top: 12px; }
        .email-footer { background-color: #f1f3f5; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header"><h1>Your Receipt</h1></div>
        <div class="email-body">
          <div class="section">
            <div class="section-title">Sale Summary</div>
            <div class="summary-grid">
              <div class="summary-item">
                <p class="summary-item-label">Transaction ID</p>
                <p class="summary-item-value">${transactionId}</p>
              </div>
              <div class="summary-item">
                <p class="summary-item-label">Date & Time</p>
                <p class="summary-item-value">${dateShort} ${time}</p>
              </div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Item Details</div>
            <table class="items-table">
              <thead><tr><th>Item</th><th style="text-align: right;">Qty</th><th style="text-align: right;">Price</th><th style="text-align: right;">Amount</th></tr></thead>
              <tbody>${items}</tbody>
            </table>
          </div>
          <div class="totals-section">
            <div class="totals-item">Subtotal: <span>$${subtotal}</span></div>
            ${discountRow}
            <div class="totals-item">Tax: <span>$${tax}</span></div>
            <div class="total-final">Total Paid: <span>$${total}</span></div>
          </div>
        </div>
        <div class="email-footer">
          <p>Thank you for your business!</p>
          <p>UrbanPOS &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}


export async function sendEmailReceipt(
  values: z.infer<typeof sendReceiptSchema>
): Promise<{ success: boolean; message: string }> {
  const validatedFields = sendReceiptSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Invalid input. Please provide a valid email.',
    };
  }

  const { email, receiptHtml } = validatedFields.data;
  
  const professionalHtml = createProfessionalEmailHtml(receiptHtml);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `UrbanPOS <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: 'Your Receipt from UrbanPOS',
      html: professionalHtml,
    });

    return {
      success: true,
      message: `Receipt sent to ${email}`,
    };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      message: 'Failed to send receipt. Please check server logs and SMTP configuration.',
    };
  }
}

export async function syncExchangeRates(): Promise<{ success: boolean; message: string }> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) {
    return {
        success: false,
        message: 'Open Exchange Rates App ID is not configured.',
    };
  }

  try {
    const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${appId}&base=USD`);
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    const data = await response.json();

    if (data.error) {
        throw new Error(`API returned an error: ${data.description}`);
    }

    const rates = data.rates;
    const lastUpdated = new Date().toISOString();

    const { firestore } = await initializeFirebase();
    const batch = writeBatch(firestore);
    const ratesCollection = collection(firestore, 'exchangeRates');

    for (const currencyCode in rates) {
      const rate = rates[currencyCode];
      const docRef = doc(ratesCollection, currencyCode);
      batch.set(docRef, {
        code: currencyCode,
        rate: rate,
        lastUpdated: lastUpdated,
      });
    }

    // Also update the settings to reflect the last sync time.
    const settingsRef = doc(firestore, 'settings', 'store-settings');
    batch.set(settingsRef, { lastCurrencySync: lastUpdated }, { merge: true });

    await batch.commit();

    return {
      success: true,
      message: `Successfully synced ${Object.keys(rates).length} exchange rates.`,
    };
  } catch (error) {
    console.error('Error syncing exchange rates:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Failed to sync exchange rates: ${errorMessage}`,
    };
  }
}
