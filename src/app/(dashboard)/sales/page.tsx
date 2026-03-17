'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import type { Sale, Product, Coupon } from '@/lib/data';
import { Separator } from '@/components/ui/separator';
import { Search, User } from 'lucide-react';

// A smaller version of the receipt for the accordion content
function SaleDetailReceipt({ 
  sale,
  products,
  coupon 
}: { 
  sale: Sale,
  products: Product[],
  coupon: Coupon | null
}) {
    const taxRate = 0.1;

    // Reconstruct the cart from the sale's `items` array
    const saleItems: { product: Product, quantity: number }[] = sale.items.map(saleItem => {
        const product = products.find(p => p.id === saleItem.productId);
        return { product, quantity: saleItem.quantity };
    }).filter((item): item is { product: Product; quantity: number } => item.product !== undefined);


    const subtotal = saleItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    const discount = coupon
        ? coupon.discountType === 'fixed'
        ? Math.min(coupon.discountValue, subtotal)
        : subtotal * (coupon.discountValue / 100)
        : 0;

    const discountedSubtotal = subtotal - discount;
    const tax = discountedSubtotal * taxRate;

    return (
        <div className="p-4 sm:p-6 bg-[#fdfbf7] dark:bg-slate-900 rounded-b-lg shadow-[inset_0_4px_10px_rgba(0,0,0,0.05)] border-t border-dashed border-slate-300 dark:border-slate-700">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <p className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Payment Method</p>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{sale.paymentMethod}</p>
                </div>
                 {sale.cashierName && (
                     <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Cashier</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{sale.cashierName}</p>
                    </div>
                )}
                {coupon && (
                    <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Coupon Applied</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{coupon.code}</p>
                    </div>
                )}
            </div>
            <table className="w-full text-sm mb-4 font-mono text-slate-700 dark:text-slate-300">
                <thead>
                    <tr className="border-b-2 border-slate-300 dark:border-slate-700">
                        <th className="text-left py-2 font-bold font-sans">Item</th>
                        <th className="text-center py-2 font-bold font-sans">Qty</th>
                        <th className="text-right py-2 font-bold font-sans">Price</th>
                        <th className="text-right py-2 font-bold font-sans">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {saleItems.map(({ product, quantity }) => (
                        <tr key={product.id} className="border-b border-dashed border-slate-200 dark:border-slate-800">
                            <td className="py-3 font-sans font-medium text-slate-900 dark:text-slate-100">{product.name}</td>
                            <td className="text-center py-3">{quantity}</td>
                            <td className="text-right py-3">${product.price.toFixed(2)}</td>
                            <td className="text-right py-3 font-bold">${(product.price * quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {/* Skeuomorphic Digital Total Screen for Receipt */}
            <div className="space-y-2 text-sm text-right bg-slate-900 dark:bg-black p-4 rounded-lg font-mono text-green-400 shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] border-4 border-slate-700 relative overflow-hidden mt-6">
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
                
                <div className="flex justify-between relative z-10 text-green-400/80">
                    <span>SUBTOTAL</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                {coupon && (
                    <div className="flex justify-between text-green-300 relative z-10">
                        <span>DISC ({coupon.code})</span>
                        <span>-${discount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between relative z-10 text-green-400/80 mb-2">
                    <span>TAX ({(taxRate * 100).toFixed(0)}%)</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                <div className="w-full h-px bg-green-800/50 my-2 relative z-10"></div>
                <div className="flex justify-between font-bold text-xl relative z-10 text-green-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">
                    <span>TOTAL</span>
                    <span>${sale.totalAmount.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
}


export default function SalesPage() {
  const [timeRange, setTimeRange] = useState('week');
  const [searchTerm, setSearchTerm] = useState('');
  const firestore = useFirestore();

  // Fetch sales
  const salesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const salesRef = collection(firestore, 'sales');
    const now = new Date();
    let startDate: Date;

    if (timeRange === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (timeRange === 'month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else { // year
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }
    
    return query(salesRef, where('saleDate', '>=', startDate.toISOString()), orderBy('saleDate', 'desc'));
  }, [firestore, timeRange]);
  const { data: sales, isLoading: isLoadingSales } = useCollection<Sale>(salesQuery);

  // Fetch all products and coupons to reconstruct receipts
  const productsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);
  const couponsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'coupons') : null, [firestore]);
  const { data: coupons, isLoading: isLoadingCoupons } = useCollection<Coupon>(couponsQuery);


  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter(sale => 
      sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.cashierName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sales, searchTerm]);

  const isLoading = isLoadingSales || isLoadingProducts || isLoadingCoupons;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales History</CardTitle>
        <CardDescription>Review and manage all past sales transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by ID or Cashier..." 
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Tabs defaultValue="week" onValueChange={setTimeRange} className="w-full sm:w-auto">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="year">Year</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>

        {isLoading && <p>Loading sales data...</p>}
        
        {!isLoading && filteredSales.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
                <p>No sales found for the selected period.</p>
            </div>
        )}

        <Accordion type="single" collapsible className="w-full space-y-2">
            {filteredSales.map((sale) => {
                const saleCoupon = coupons?.find(c => c.code === sale.appliedCoupon) ?? null;
                const saleProducts = products ?? [];

                return (
                    <AccordionItem value={sale.id} key={sale.id} className="border-b-0">
                        <AccordionTrigger className="border-2 border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-[0_4px_0_theme(colors.slate.200)] dark:shadow-[0_4px_0_theme(colors.slate.950)] hover:no-underline hover:bg-slate-100 hover:translate-y-[2px] hover:shadow-[0_2px_0_theme(colors.slate.200)] active:shadow-none active:translate-y-[4px] transition-all data-[state=open]:rounded-b-none data-[state=open]:border-b-0 data-[state=open]:shadow-none data-[state=open]:translate-y-[4px] mb-4 data-[state=open]:mb-0">
                            <div className="flex justify-between items-center w-full">
                                <div className="text-left">
                                    <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{sale.id}</p>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{new Date(sale.saleDate).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                     <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1 bg-white dark:bg-slate-800 shadow-sm border-2">
                                        <User className="h-3 w-3" />
                                        {sale.cashierName || 'N/A'}
                                     </Badge>
                                    <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">${sale.totalAmount.toFixed(2)}</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="border border-t-0 rounded-b-lg p-0">
                           <SaleDetailReceipt sale={sale} products={saleProducts} coupon={saleCoupon} />
                        </AccordionContent>
                    </AccordionItem>
                )
            })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
