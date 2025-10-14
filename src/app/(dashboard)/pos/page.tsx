'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  PlusCircle,
  MinusCircle,
  Tag,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Receipt } from '@/components/receipt';
import { useFirestore, useMemoFirebase, useCollection, useDoc, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc, writeBatch, increment } from 'firebase/firestore';
import type { Product, Coupon, Settings, ExchangeRate } from '@/lib/data';


export type CartItem = {
  product: Product;
  quantity: number;
};

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);
  
  const [latestCart, setLatestCart] = useState<CartItem[]>([]);
  const [latestAppliedCoupon, setLatestAppliedCoupon] = useState<Coupon | null>(null);
  const [latestDiscount, setLatestDiscount] = useState(0);
  const [latestTransactionId, setLatestTransactionId] = useState('');
  const [latestCashierName, setLatestCashierName] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');


  const [showReceipt, setShowReceipt] = useState(false);
  const { toast } = useToast();
  
  const firestore = useFirestore();
  const { user } = useUser();
  
  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'store-settings') : null),
    [firestore]
  );
  const { data: settings } = useDoc<Settings>(settingsDocRef);
  const taxRate = (settings?.defaultTaxRate || 0) / 100;
  const baseCurrency = settings?.baseCurrency || 'USD';

  const productsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

  const exchangeRatesQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'exchangeRates') : null),
    [firestore]
  );
  const { data: exchangeRates, isLoading: isLoadingRates } = useCollection<ExchangeRate>(exchangeRatesQuery);

  const salesCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'sales') : null),
    [firestore]
  );

  const couponsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'coupons') : null),
    [firestore]
  );

  const conversionRate = useMemo(() => {
    if (selectedCurrency === baseCurrency) return 1;
    return exchangeRates?.find(rate => rate.code === selectedCurrency)?.rate || 1;
  }, [selectedCurrency, exchangeRates, baseCurrency]);

  const currencySymbol = useMemo(() => {
    // This is a simplified mapping. A library like 'currency-symbol-map' would be better for production.
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'BDT': '৳',
    };
    return symbols[selectedCurrency] || selectedCurrency;
  }, [selectedCurrency]);
  
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let productsByCategory = products;
    if (selectedCategory !== 'All Categories') {
      productsByCategory = products.filter(p => p.category === selectedCategory);
    }
    
    if (!searchQuery) return productsByCategory;

    return productsByCategory.filter(product => 
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, selectedCategory, searchQuery]);

  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) {
      toast({
        variant: 'destructive',
        title: 'Out of stock',
        description: `${product.name} is currently out of stock.`,
      });
      return;
    }
    setCart(prevCart => {
      const existingItem = prevCart.find(
        item => item.product.id === product.id
      );
      if (existingItem) {
        if (existingItem.quantity >= product.stockQuantity) {
           toast({
            variant: 'destructive',
            title: 'Stock limit reached',
            description: `You cannot add more ${product.name} than is available in stock.`,
          });
          return prevCart;
        }
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const itemInCart = cart.find(item => item.product.id === productId);
    if(itemInCart && quantity > itemInCart.product.stockQuantity) {
      toast({
        variant: 'destructive',
        title: 'Stock limit reached',
        description: `You cannot add more ${itemInCart.product.name} than is available in stock.`,
      });
      return;
    }

    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(prevCart =>
        prevCart.map(item =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  
  const discount = appliedCoupon
    ? appliedCoupon.discountType === 'fixed'
      ? Math.min(appliedCoupon.discountValue, subtotal)
      : subtotal * (appliedCoupon.discountValue / 100)
    : 0;
  
  const discountedSubtotal = subtotal - discount;
  const tax = discountedSubtotal * taxRate;
  const total = discountedSubtotal + tax;

  const handleApplyCoupon = async () => {
    if (!couponsCollection) return;
    const q = query(couponsCollection, where('code', '==', couponCode.toUpperCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      toast({ variant: 'destructive', title: 'Invalid Coupon', description: 'This coupon code does not exist.' });
      return;
    }
    const couponDoc = querySnapshot.docs[0];
    const couponData = { id: couponDoc.id, ...couponDoc.data() } as Coupon;

    if (!couponData.isActive) {
       toast({ variant: 'destructive', title: 'Inactive Coupon', description: 'This coupon is no longer active.' });
       return;
    }
    if (new Date(couponData.expirationDate) < new Date()) {
       toast({ variant: 'destructive', title: 'Expired Coupon', description: 'This coupon has expired.' });
       return;
    }
    if (couponData.usageCount >= couponData.usageLimit) {
       toast({ variant: 'destructive', title: 'Coupon Limit Reached', description: 'This coupon has been used the maximum number of times.' });
       return;
    }

    setAppliedCoupon(couponData);
    toast({ title: 'Coupon Applied', description: `Coupon ${couponData.code} has been successfully applied.` });
    setIsCouponDialogOpen(false);
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast({ title: 'Coupon Removed' });
  }

  const handlePayment = async () => {
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Cart is empty', description: 'Add products to start a sale.' });
      return;
    }
    if (!salesCollection || !firestore || !user) return;
    
    const permissions = JSON.parse(sessionStorage.getItem('userPermissions') || '{}');
    const cashierName = permissions.tagName || 'Unknown';

    try {
        const batch = writeBatch(firestore);
        
        const transactionId = `TXN-${Date.now()}`;
        const saleRef = doc(firestore, 'sales', transactionId);
        
        batch.set(saleRef, {
            saleDate: new Date().toISOString(),
            totalAmount: total,
            paymentMethod: 'card',
            items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, priceAtTime: item.product.price })),
            appliedCoupon: appliedCoupon?.code || null,
            cashierId: user.uid,
            cashierName: cashierName,
            baseCurrency: baseCurrency,
            displayCurrency: selectedCurrency,
            conversionRate: conversionRate,
        });

        cart.forEach(item => {
            const productRef = doc(firestore, 'products', item.product.id);
            batch.update(productRef, { stockQuantity: increment(-item.quantity) });
        });
        
        if (appliedCoupon) {
            const couponRef = doc(firestore, 'coupons', appliedCoupon.id);
            batch.update(couponRef, { usageCount: increment(1) });
        }

        await batch.commit();

        setLatestTransactionId(transactionId);
        setLatestCart(cart);
        setLatestAppliedCoupon(appliedCoupon);
        setLatestDiscount(discount);
        setLatestCashierName(cashierName);
        setShowReceipt(true);
        setCart([]);
        setAppliedCoupon(null);
        
        toast({
          title: 'Payment Successful',
          description: `Total: ${currencySymbol}${(total * conversionRate).toFixed(2)}`,
        });

    } catch (error) {
        console.error("Payment failed:", error);
        toast({
            variant: 'destructive',
            title: 'Payment Failed',
            description: 'Could not process the transaction. Please try again.',
        });
    }

  };

  const categories = products ? ['All Categories', ...Array.from(new Set(products.map(p => p.category)))] : ['All Categories'];
  const currencyCodes = useMemo(() => {
    const codes = new Set<string>();
    codes.add(baseCurrency);
    if (exchangeRates) {
        exchangeRates.forEach(rate => codes.add(rate.code));
    }
    return Array.from(codes).sort();
  }, [exchangeRates, baseCurrency]);

  const latestSubtotal = latestCart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const latestDiscountedSubtotal = latestSubtotal - latestDiscount;
  const latestTax = latestDiscountedSubtotal * taxRate;
  const latestTotal = latestDiscountedSubtotal + latestTax;

  const isLoading = isLoadingProducts || isLoadingRates;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start h-full">
        <div className="lg:col-span-3 h-full flex flex-col">
          <Card className="flex flex-col flex-grow">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Products</CardTitle>
                <div className="w-auto">
                   <Select value={selectedCurrency} onValueChange={setSelectedCurrency} disabled={isLoadingRates}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencyCodes.map(code => (
                          <SelectItem key={code} value={code}>{code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                 <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <Input 
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ScrollArea className="h-[calc(100vh-21rem)]">
                {isLoading && <p>Loading products...</p>}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {filteredProducts.map(product => (
                    <Card
                      key={product.id}
                      className="overflow-hidden cursor-pointer group"
                      onClick={() => addToCart(product)}
                    >
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={400}
                        height={300}
                        data-ai-hint={product.imageHint}
                        className="object-cover w-full h-32 transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="p-3">
                        <h3 className="text-sm font-semibold truncate">
                          {product.name}
                        </h3>
                         <p className="text-lg font-bold">{currencySymbol}{(product.price * conversionRate).toFixed(2)}</p>
                         <Badge variant="outline" className="mt-1">{product.category}</Badge>
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Stock: {product.stockQuantity}</span>
                          <Progress value={(product.stockQuantity / 100) * 100} className="h-2 mt-1" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Current Sale</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-12 px-6">
                  Add products to start a sale.
                </p>
              ) : (
                <ScrollArea className="h-[calc(100vh-28rem)]">
                  <div className="space-y-4 p-6">
                    {cart.map(item => (
                      <div
                        key={item.product.id}
                        className="flex items-center gap-4"
                      >
                        <Image
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          width={48}
                          height={48}
                          data-ai-hint={item.product.imageHint}
                          className="rounded-md object-cover"
                        />
                        <div className="flex-grow">
                          <p className="font-medium text-sm truncate">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                             {currencySymbol}{(item.product.price * conversionRate).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              updateQuantity(item.product.id, item.quantity - 1)
                            }
                          >
                            <MinusCircle className="h-4 w-4" />
                          </Button>
                          <span className="w-4 text-center">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              updateQuantity(item.product.id, item.quantity + 1)
                            }
                          >
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="font-semibold w-20 text-right">
                          {currencySymbol}{(item.product.price * item.quantity * conversionRate).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
            <Separator />
            <CardFooter className="flex flex-col gap-4 p-6">
              <div className="w-full flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{currencySymbol}{(subtotal * conversionRate).toFixed(2)}</span>
              </div>
               {appliedCoupon && (
                <>
                  <div className="w-full flex justify-between text-sm text-green-600">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Discount ({appliedCoupon.code})</span>
                       <XCircle className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive" onClick={handleRemoveCoupon}/>
                    </div>
                    <span>-{currencySymbol}{(discount * conversionRate).toFixed(2)}</span>
                  </div>
                  <div className="w-full flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">New Subtotal</span>
                    <span>{currencySymbol}{(discountedSubtotal * conversionRate).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="w-full flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({settings?.defaultTaxRate || 0}%)</span>
                <span>{currencySymbol}{(tax * conversionRate).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="w-full flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{currencySymbol}{(total * conversionRate).toFixed(2)}</span>
              </div>
               <Button className="w-full" size="lg" onClick={handlePayment} disabled={cart.length === 0}>
                Pay
              </Button>
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button variant="outline" onClick={() => setIsCouponDialogOpen(true)}>
                  <Tag className="mr-2 h-4 w-4"/>
                  Apply Coupon
                </Button>
                <Button variant="destructive"  onClick={clearCart}>
                   <Trash2 className="mr-2 h-4 w-4"/>
                  Clear Cart
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          <Receipt 
            cart={latestCart}
            subtotal={latestSubtotal}
            discount={latestDiscount}
            appliedCoupon={latestAppliedCoupon}
            tax={latestTax}
            total={latestTotal}
            transactionId={latestTransactionId}
            cashierName={latestCashierName}
            baseCurrency={baseCurrency}
            displayCurrency={selectedCurrency}
            conversionRate={conversionRate}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Coupon</DialogTitle>
            <DialogDescription>Enter a coupon code to apply a discount to this sale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input 
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCouponDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyCoupon}>Apply Coupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
