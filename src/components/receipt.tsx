'use client';

import React, { useRef, useState, useEffect } from 'react';
import type { CartItem } from '@/app/(dashboard)/pos/page';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Mail, Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { sendEmailReceipt } from '@/app/actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Coupon, Settings } from '@/lib/data';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';


interface ReceiptProps {
  cart: CartItem[];
  subtotal: number;
  discount: number;
  appliedCoupon: Coupon | null;
  tax: number;
  total: number;
  transactionId: string;
  cashierName: string;
  baseCurrency: string;
  displayCurrency: string;
  conversionRate: number;
  settings?: Partial<Settings>;
}

export function Receipt({ cart, subtotal, discount, appliedCoupon, tax, total, transactionId, cashierName, baseCurrency, displayCurrency, conversionRate, settings: passedSettings }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const firestore = useFirestore();
  const settingsDocRef = useMemoFirebase(
    () => (firestore && !passedSettings ? doc(firestore, 'settings', 'store-settings') : null),
    [firestore, passedSettings]
  );
  const { data: fetchedSettings, isLoading: isLoadingSettings } = useDoc<Settings>(settingsDocRef);
  
  const settings = passedSettings || fetchedSettings;

  const handlePrint = () => {
    if (receiptRef.current) {
        const printContent = receiptRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Print Receipt</title>');
            printWindow.document.write('<style>body { font-family: monospace; } #receipt-content { width: 300px; margin: 0 auto; } table { width: 100%;} th { text-align: left; } .text-right { text-align: right; } .text-center { text-align: center; } hr { border: none; border-top: 1px dashed #000; } </style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(`<div id="receipt-content">${printContent}</div>`);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }
    }
  };
  
  const handleEmail = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Please enter an email address.',
      });
      return;
    }
    
    if (receiptRef.current) {
      setIsSending(true);
      const receiptHtml = receiptRef.current.innerHTML;
      const result = await sendEmailReceipt({ email, receiptHtml });

      if (result.success) {
        toast({
          title: 'Email Sent',
          description: result.message,
        });
        setEmail('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
      setIsSending(false);
    }
  };

  const today = new Date();

  if (isLoadingSettings && !passedSettings) {
    return <p>Loading Receipt...</p>
  }
  
  const currencySymbol = (currency: string) => {
    const symbols: { [key: string]: string } = { 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'BDT': '৳' };
    return symbols[currency] || currency;
  }
  
  const convertedTotal = total * conversionRate;
  const showBothCurrencies = baseCurrency !== displayCurrency;

  return (
    <div className="bg-background text-foreground font-sans">
      <ScrollArea className="h-[60vh]">
       <div ref={receiptRef} className="p-6 bg-white text-gray-800">
          <div className="max-w-md mx-auto bg-white p-4">
            <header className="receipt-header text-center mb-4 p-4 rounded-t-lg bg-primary text-primary-foreground">
                <h1 className="text-2xl font-bold">{settings?.storeName || 'UrbanPOS'}</h1>
                {settings?.showStoreAddress && <p className="text-sm">{settings?.storeAddress}</p>}
            </header>
            
            <section className="section text-sm">
                <div className="mb-4">
                    <div className="flex justify-between">
                        <span>Transaction ID:</span>
                        <span data-transaction-id={transactionId}>{transactionId}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Date:</span>
                        <span data-date-short={today.toLocaleDateString()}>{today.toLocaleDateString()}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Time:</span>
                        <span data-time={today.toLocaleTimeString()}>{today.toLocaleTimeString()}</span>
                    </div>
                     <div className="flex justify-between">
                        <span>Cashier:</span>
                        <span data-cashier-name={cashierName}>{cashierName}</span>
                    </div>
                </div>

                <hr className="my-2 border-dashed"/>

                <div>
                    <table className="items-table w-full">
                        <thead>
                            <tr>
                                <th className="text-left font-semibold">Item</th>
                                <th className="text-center font-semibold">Qty</th>
                                <th className="text-right font-semibold">Price</th>
                                <th className="text-right font-semibold">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map(item => (
                                <tr key={item.product.id}>
                                    <td>{item.product.name}</td>
                                    <td className="text-center">{item.quantity}</td>
                                    <td className="text-right">{currencySymbol(displayCurrency)}{(item.product.price * conversionRate).toFixed(2)}</td>
                                    <td className="text-right">{currencySymbol(displayCurrency)}{(item.product.price * item.quantity * conversionRate).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                 <hr className="my-2 border-dashed"/>

                <div className="totals-section space-y-1">
                    <div className="flex justify-between"><span className="label">Subtotal:</span> <span className="value" data-subtotal={(subtotal * conversionRate).toFixed(2)}>{currencySymbol(displayCurrency)}{(subtotal * conversionRate).toFixed(2)}</span></div>
                     {appliedCoupon && (
                        <div className="flex justify-between text-green-600">
                            <span className="label">Discount (<span data-coupon-code={appliedCoupon.code}>{appliedCoupon.code}</span>):</span> 
                            <span className="value" data-discount={(discount*conversionRate).toFixed(2)}>-{currencySymbol(displayCurrency)}{(discount*conversionRate).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between"><span className="label">Tax:</span> <span className="value" data-tax={(tax*conversionRate).toFixed(2)}>{currencySymbol(displayCurrency)}{(tax*conversionRate).toFixed(2)}</span></div>
                    <hr className="my-1 border-dashed"/>
                    <div className="flex justify-between font-bold text-lg"><span className="label">Total Paid:</span> <span className="value" data-total={convertedTotal.toFixed(2)}>{currencySymbol(displayCurrency)}{convertedTotal.toFixed(2)}</span></div>
                    {showBothCurrencies && (
                       <div className="flex justify-between text-muted-foreground text-xs"><span className="label">Total in {baseCurrency}:</span> <span className="value">{currencySymbol(baseCurrency)}{total.toFixed(2)}</span></div>
                    )}
                </div>
            </section>

            <footer className="receipt-footer text-center mt-4 pt-4 border-t border-dashed">
                <p className="text-xs">{settings?.receiptFooterMessage || 'Thank you for your business!'}</p>
            </footer>
        </div>
      </div>
      </ScrollArea>
       <div className="p-4 bg-muted/50 border-t rounded-b-lg">
        <div className="flex items-center space-x-2 mb-4">
            <Input 
              type="email" 
              placeholder="Customer's email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
            />
            <Button onClick={handleEmail} disabled={isSending}>
              {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                 <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send Email</span>
            </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <Button onClick={handlePrint} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                Print
            </Button>
             <a href={`mailto:${email}`} className="w-full">
              <Button className="w-full">
                <Mail className="mr-2 h-4 w-4" />
                Email
              </Button>
            </a>
        </div>
      </div>
    </div>
  );
}
