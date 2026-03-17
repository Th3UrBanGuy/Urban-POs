'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  PlusCircle,
  MinusCircle,
  Tag,
  Trash2,
  XCircle,
  ShoppingBag,
  CreditCard,
  Search,
  MonitorSmartphone,
  LayoutGrid,
  List,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
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
    setCart(prevCart => {
      const newCart = prevCart.filter(item => item.product.id !== productId);
      if (newCart.length === 0) setIsMobileCartOpen(false); // Close mobile sheet if empty
      return newCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
    setIsMobileCartOpen(false); // Close mobile sheet on clear
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
        setIsMobileCartOpen(false); // Close sheet after payment
        
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

  const renderCartCard = (isMobile: boolean = false) => {
    
    const InnerContent = () => (
      <>
        {!isMobile && (
          <CardHeader className="bg-slate-200/60 dark:bg-slate-800/60 border-b border-slate-300 dark:border-slate-700 py-4 shadow-sm z-10">
            <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <ShoppingBag className="h-5 w-5" />
              Current Sale
            </CardTitle>
          </CardHeader>
        )}
      
      {/* Receipt Paper Background */}
      <CardContent className={`p-0 flex-grow bg-[#fdfbf7] dark:bg-slate-900 relative ${!isMobile ? 'shadow-inner' : ''}`}>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-12 px-6 text-center">
            <ShoppingBag className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">No items scanned.</p>
            <p className="text-sm">Scan or tap products to add them to the sale.</p>
          </div>
        ) : (
          <ScrollArea className={`${isMobile ? 'h-[calc(95vh-22rem)]' : 'h-[calc(70vh-28rem)] lg:h-[calc(100vh-32rem)]'}`}>
            <div className="space-y-4 p-4 md:p-6">
              {cart.map(item => (
                <div
                  key={item.product.id}
                  className="font-mono text-sm border-b border-dashed border-slate-300 dark:border-slate-700 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 shadow-sm bg-white">
                      <Image
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        width={48}
                        height={48}
                        data-ai-hint={item.product.imageHint}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    
                    <div className="flex-grow">
                      <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 mb-1 leading-none">
                        <span className="truncate pr-2 font-sans text-sm">{item.product.name}</span>
                        <span>{currencySymbol}{(item.product.price * item.quantity * conversionRate).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-2">
                        <span className="font-mono">{item.quantity} x {currencySymbol}{(item.product.price * conversionRate).toFixed(2)}</span>
                        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 rounded-md p-1 shadow-inner border border-slate-300 dark:border-slate-700">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-sm bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:translate-y-[1px] active:shadow-none" 
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          >
                            <MinusCircle className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                          </Button>
                          <span className="w-6 text-center font-bold text-slate-700 dark:text-slate-200 font-sans text-sm">{item.quantity}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-sm bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:translate-y-[1px] active:shadow-none" 
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          >
                            <PlusCircle className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
      <Separator className="bg-slate-300 dark:bg-slate-700" />
      <CardFooter className={`flex flex-col gap-4 p-4 md:p-6 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-10 ${isMobile ? 'pb-8' : 'border-t-4'}`}>
        
        {/* Skeuomorphic Digital Total Screen */}
        <div className="w-full bg-slate-900 dark:bg-black border-4 border-slate-700 dark:border-slate-800 rounded-lg p-3 md:p-4 shadow-[inset_0_4px_15px_rgba(0,0,0,0.6)] font-mono text-green-400 relative overflow-hidden">
          {/* Scanline overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
          
          <div className="w-full flex justify-between text-sm text-green-400/80 mb-1 relative z-10">
            <span>SUBTOTAL</span>
            <span>{currencySymbol}{(subtotal * conversionRate).toFixed(2)}</span>
          </div>
          {appliedCoupon && (
            <div className="w-full flex justify-between text-sm text-green-300 mb-1 relative z-10">
              <div className="flex items-center gap-2">
                <span>DISC ({appliedCoupon.code})</span>
                <div 
                  className="p-2 -m-2 cursor-pointer hover:bg-slate-800 rounded-full transition-colors flex items-center justify-center"
                  onClick={handleRemoveCoupon}
                >
                  <XCircle className="h-4 w-4 text-slate-400 hover:text-red-400" />
                </div>
              </div>
              <span>-{currencySymbol}{(discount * conversionRate).toFixed(2)}</span>
            </div>
          )}
          <div className="w-full flex justify-between text-sm text-green-400/80 mb-2 relative z-10">
            <span>TAX ({settings?.defaultTaxRate || 0}%)</span>
            <span>{currencySymbol}{(tax * conversionRate).toFixed(2)}</span>
          </div>
          <div className="w-full h-px bg-green-800/50 my-2 shadow-[0_1px_2px_rgba(0,0,0,0.5)] relative z-10"></div>
          <div className="w-full flex justify-between font-bold text-xl md:text-2xl text-green-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)] relative z-10">
            <span>TOTAL</span>
            <span>{currencySymbol}{(total * conversionRate).toFixed(2)}</span>
          </div>
        </div>

        <Button 
          className="w-full h-14 md:h-16 text-lg md:text-xl font-bold uppercase tracking-widest bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white shadow-[0_6px_0_theme(colors.green.800)] hover:shadow-[0_4px_0_theme(colors.green.800)] hover:translate-y-[2px] active:shadow-[0_0px_0_theme(colors.green.800)] active:translate-y-[6px] transition-all rounded-xl border border-green-400/50" 
          onClick={handlePayment} 
          disabled={cart.length === 0}
        >
          <CreditCard className="mr-3 h-5 w-5 md:h-6 md:w-6" />
          Pay Now
        </Button>
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button 
            variant="outline" 
            className="h-10 md:h-12 border-2 text-sm border-slate-300 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:translate-y-1 active:shadow-none transition-all rounded-lg"
            onClick={() => setIsCouponDialogOpen(true)}
          >
            <Tag className="mr-2 h-4 w-4"/>
            Coupon
          </Button>
          <Button 
            variant="destructive" 
            className="h-10 md:h-12 border-2 bg-gradient-to-b text-sm from-red-500 to-red-600 border border-red-400 shadow-[0_4px_0_theme(colors.red.800)] active:shadow-none active:translate-y-[4px] transition-all rounded-lg"
            onClick={clearCart}
          >
            <Trash2 className="mr-2 h-4 w-4"/>
            Clear
          </Button>
        </div>
      </CardFooter>
      </>
    );

    if (isMobile) {
      return <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950"><InnerContent /></div>;
    }

    return (
      <Card className="flex flex-col h-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-2 border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 overflow-hidden rounded-xl">
        <InnerContent />
      </Card>
    );
  };

  return (
    <div className="h-full bg-slate-100 dark:bg-slate-950 p-3 md:p-6 lg:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start h-full pb-28 lg:pb-0 mx-auto max-w-7xl">
        <div className="lg:col-span-3 h-full flex flex-col">
          <Card className="flex flex-col flex-grow shadow-lg border-2 border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <MonitorSmartphone className="h-5 w-5 md:h-6 md:w-6 text-slate-500" />
                  Terminal
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1 shadow-inner border-2 border-slate-300 dark:border-slate-700">
                    <Button
                      variant={viewMode === 'grid' ? "default" : "ghost"}
                      size="icon"
                      className={`h-8 w-8 rounded-md ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-slate-300/50 dark:hover:bg-slate-700/50'}`}
                      onClick={() => setViewMode('grid')}
                      title="Grid View"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? "default" : "ghost"}
                      size="icon"
                      className={`h-8 w-8 rounded-md ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-slate-300/50 dark:hover:bg-slate-700/50'}`}
                      onClick={() => setViewMode('list')}
                      title="List View"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="w-28 md:w-32 hidden sm:block">
                     <Select value={selectedCurrency} onValueChange={setSelectedCurrency} disabled={isLoadingRates}>
                        <SelectTrigger className="border-2 border-slate-200 dark:border-slate-700 shadow-sm rounded-lg font-bold bg-white dark:bg-slate-900">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyCodes.map(code => (
                            <SelectItem key={code} value={code} className="font-medium">{code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-3 gap-3">
                 <div className="sm:col-span-1 lg:col-span-1">
                   <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full border-2 border-slate-200 dark:border-slate-700 shadow-sm rounded-lg font-medium bg-white dark:bg-slate-900">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category} value={category} className="font-medium">{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
                <div className="flex sm:hidden w-full col-span-1">
                     <Select value={selectedCurrency} onValueChange={setSelectedCurrency} disabled={isLoadingRates}>
                        <SelectTrigger className="w-full border-2 border-slate-200 dark:border-slate-700 shadow-sm rounded-lg font-bold bg-white dark:bg-slate-900">
                          <SelectValue placeholder="Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {currencyCodes.map(code => (
                            <SelectItem key={code} value={code} className="font-medium">{code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  </div>
                <div className="sm:col-span-3 lg:col-span-2 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Scan or search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-11 w-full border-2 border-slate-200 dark:border-slate-700 shadow-sm rounded-lg focus-visible:ring-slate-400 font-medium bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-grow p-4 md:p-6 bg-slate-50 dark:bg-slate-950/50 shadow-inner">
              <ScrollArea className="h-[calc(100vh-22rem)] md:h-[calc(100vh-24rem)]">
                {isLoading && (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-slate-500 font-medium animate-pulse">Initializing terminal...</p>
                  </div>
                )}
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6 px-1 pb-4">
                    {filteredProducts.map(product => (
                      <Card
                        key={product.id}
                        className="overflow-hidden cursor-pointer group bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 border-b-[6px] md:border-b-[8px] hover:border-b-slate-400 dark:hover:border-b-indigo-500 rounded-xl active:border-b-2 active:translate-y-[4px] md:active:translate-y-[6px] transition-all duration-100 shadow-[0_4px_10px_rgba(0,0,0,0.05)]"
                        onClick={() => addToCart(product)}
                      >
                        <div className="relative">
                          <Image
                            src={product.imageUrl}
                            alt={product.name}
                            width={400}
                            height={300}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            data-ai-hint={product.imageHint}
                            className="object-cover w-full h-24 sm:h-28 md:h-36 lg:h-40 group-hover:opacity-90 transition-opacity"
                          />
                          {/* Overlay shadow for inset feel */}
                          <div className="absolute inset-0 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.1)] pointer-events-none"></div>
                          <Badge className="absolute top-2 right-2 bg-white/95 text-slate-800 hover:bg-white backdrop-blur-sm shadow-sm border border-slate-200 font-semibold text-[9px] sm:text-[10px] md:text-xs max-w-[80%] truncate p-0.5 px-1.5 md:p-1 md:px-2.5">
                            {product.category}
                          </Badge>
                        </div>
                        <div className="p-2 sm:p-3 md:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 group-active:bg-slate-50 dark:group-active:bg-slate-800">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate mb-1">
                            {product.name}
                          </h3>
                          <p className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                             {currencySymbol}{(product.price * conversionRate).toFixed(2)}
                          </p>
                          <div className="mt-2 md:mt-3 flex items-center justify-between">
                            <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:block">Stock</span>
                            <span className={`text-[10px] md:text-xs font-bold ${product.stockQuantity < 10 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                              {product.stockQuantity} <span className="sm:hidden text-[9px] font-normal text-slate-400">left</span>
                            </span>
                          </div>
                          <Progress 
                             value={(product.stockQuantity / 100) * 100} 
                             className={`h-1 sm:h-1.5 mt-1 md:mt-1.5 ${product.stockQuantity < 10 ? '[&>div]:bg-red-500' : '[&>div]:bg-slate-700 dark:[&>div]:bg-slate-500'}`} 
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:gap-3 px-1 pb-4">
                    {filteredProducts.map(product => (
                      <Card
                        key={product.id}
                        className="flex flex-row items-center justify-between p-3 sm:p-4 cursor-pointer group bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200 dark:border-slate-700 border-b-[4px] hover:border-b-slate-400 dark:hover:border-b-indigo-500 rounded-xl active:border-b-2 active:translate-y-[2px] transition-all duration-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
                        onClick={() => addToCart(product)}
                      >
                       <div className="flex flex-col gap-1 overflow-hidden pr-3">
                          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2">
                             <Badge variant="outline" className="text-[10px] py-0 bg-white dark:bg-slate-800 text-slate-500 border-slate-300 shadow-sm truncate max-w-[120px]">
                                {product.category}
                             </Badge>
                             <span className={`text-[10px] font-semibold ${product.stockQuantity < 10 ? 'text-red-500' : 'text-slate-400'}`}>
                               {product.stockQuantity} in stock
                             </span>
                          </div>
                       </div>
                       <div className="flex-shrink-0 text-right">
                          <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                             {currencySymbol}{(product.price * conversionRate).toFixed(2)}
                          </p>
                       </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Cart */}
        <div className="hidden lg:block lg:col-span-1 h-full">
          {renderCartCard()}
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] lg:hidden z-40 flex items-center justify-between pb-8 pt-4">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total ({cart.length} items)</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
             {currencySymbol}{(total * conversionRate).toFixed(2)}
          </span>
        </div>
        <Button 
          size="lg" 
          className="h-14 px-8 rounded-xl shadow-[0_6px_0_theme(colors.green.800)] bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 border border-green-500 active:translate-y-[6px] active:shadow-none text-lg font-bold transition-all text-white"
          onClick={() => setIsMobileCartOpen(true)}
        >
          <ShoppingBag className="mr-2 h-5 w-5" />
          View Cart
        </Button>
      </div>

      {/* Mobile Cart Sheet */}
      <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <SheetContent side="bottom" className="h-[95vh] p-0 flex flex-col bg-slate-50 dark:bg-slate-950 sm:max-w-md sm:mx-auto rounded-t-3xl border-t-4 border-slate-200 dark:border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
          <SheetHeader className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 rounded-t-3xl">
            <SheetTitle className="text-xl font-bold flex items-center justify-center gap-2 text-slate-800 dark:text-slate-100">
              <ShoppingBag className="h-5 w-5" />
              Current Sale
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
             {renderCartCard(true)}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md sm:rounded-2xl border-4 border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Tag className="h-5 w-5 text-slate-500"/>
              Receipt
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-950">
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
        <DialogContent className="sm:max-w-sm sm:rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Apply Coupon</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium">Enter a code to apply a discount to this sale.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              placeholder="e.g. SUMMER10"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="text-lg font-bold tracking-widest text-center uppercase border-2 border-slate-200 shadow-inner h-14 rounded-xl"
            />
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0">
            <Button variant="outline" className="h-12 rounded-xl border-2 font-bold" onClick={() => setIsCouponDialogOpen(false)}>Cancel</Button>
            <Button className="h-12 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-[0_4px_0_theme(colors.slate.700)] active:translate-y-[4px] active:shadow-none transition-all" onClick={handleApplyCoupon}>Apply Code</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
