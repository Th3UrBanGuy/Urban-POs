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
        <div className="p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                    <p className="font-semibold">Payment Method</p>
                    <p className="text-muted-foreground">{sale.paymentMethod}</p>
                </div>
                 {sale.cashierName && (
                     <div>
                        <p className="font-semibold">Cashier</p>
                        <p className="text-muted-foreground">{sale.cashierName}</p>
                    </div>
                )}
                {coupon && (
                    <div>
                        <p className="font-semibold">Coupon Applied</p>
                        <p className="text-muted-foreground">{coupon.code}</p>
                    </div>
                )}
            </div>
            <table className="w-full text-sm mb-4">
                <thead>
                    <tr className="border-b">
                        <th className="text-left py-2 font-semibold">Item</th>
                        <th className="text-center py-2 font-semibold">Qty</th>
                        <th className="text-right py-2 font-semibold">Price</th>
                        <th className="text-right py-2 font-semibold">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {saleItems.map(({ product, quantity }) => (
                        <tr key={product.id} className="border-b">
                            <td className="py-2">{product.name}</td>
                            <td className="text-center py-2">{quantity}</td>
                            <td className="text-right py-2">${product.price.toFixed(2)}</td>
                            <td className="text-right py-2">${(product.price * quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="space-y-2 text-sm text-right">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                {coupon && (
                    <div className="flex justify-between text-green-600">
                        <span className="text-muted-foreground">Discount ({coupon.code})</span>
                        <span>-${discount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(0)}%)</span>
                    <span>${tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
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
                        <AccordionTrigger className="border rounded-lg px-4 py-3 hover:no-underline hover:bg-muted/50 data-[state=open]:rounded-b-none data-[state=open]:border-b-0">
                            <div className="flex justify-between items-center w-full">
                                <div className="text-left">
                                    <p className="font-mono text-sm font-semibold">{sale.id}</p>
                                    <p className="text-xs text-muted-foreground">{new Date(sale.saleDate).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                     <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {sale.cashierName || 'N/A'}
                                     </Badge>
                                    <p className="text-lg font-bold">${sale.totalAmount.toFixed(2)}</p>
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
