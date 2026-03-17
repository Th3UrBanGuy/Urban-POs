'use client';

import {
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Package,
  Tag,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, limit, getDocs, orderBy, startAt, endAt, where } from 'firebase/firestore';
import type { Sale, Product, Coupon } from '@/lib/data';
import { useEffect, useState } from 'react';
import { subMonths, format, getYear, getMonth } from 'date-fns';

const chartConfig = {
  total: {
    label: 'Total',
    color: 'hsl(var(--primary))',
  },
};

type MonthlySales = {
  name: string;
  total: number;
};

export default function Dashboard() {
  const firestore = useFirestore();
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [activeCoupons, setActiveCoupons] = useState(0);
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const recentSalesQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'sales'), orderBy('saleDate', 'desc'), limit(5))
        : null,
    [firestore]
  );
  const { data: recentSales, isLoading: recentSalesLoading } = useCollection<Sale>(recentSalesQuery);

  useEffect(() => {
    if (!firestore) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const salesCollection = collection(firestore, 'sales');
        const productsCollection = collection(firestore, 'products');
        const couponsCollection = collection(firestore, 'coupons');

        // Fetch all sales for revenue and count
        const salesSnapshot = await getDocs(salesCollection);
        let revenue = 0;
        salesSnapshot.forEach(doc => {
          revenue += doc.data().totalAmount || 0;
        });
        setTotalRevenue(revenue);
        setTotalSales(salesSnapshot.size);

        // Monthly sales for chart
        const salesByMonth: MonthlySales[] = Array.from({ length: 12 }, (_, i) => {
            const d = subMonths(new Date(), 11 - i);
            return { name: format(d, 'MMM'), total: 0 };
        });

        const oneYearAgo = subMonths(new Date(), 12);
        const salesQuery = query(collection(firestore, 'sales'), where('saleDate', '>=', oneYearAgo.toISOString()));
        const monthlySalesSnapshot = await getDocs(salesQuery);
        
        monthlySalesSnapshot.forEach(doc => {
            const sale = doc.data() as Sale;
            const monthIndex = new Date(sale.saleDate).getMonth();
            const currentYear = new Date().getFullYear();
            const saleYear = new Date(sale.saleDate).getFullYear();
            
            // This logic is a bit complex to fit into a simple 12 month array
            // For now, let's just populate the current year's months
            const monthName = format(new Date(sale.saleDate), 'MMM');
            const targetMonth = salesByMonth.find(m => m.name === monthName);
            if(targetMonth) {
                 targetMonth.total += sale.totalAmount;
            }
        });
        setMonthlySales(salesByMonth);

        // Fetch product count
        const productsSnapshot = await getDocs(productsCollection);
        setTotalProducts(productsSnapshot.size);

        // Fetch active coupons
        const activeCouponsQuery = query(couponsCollection, where('isActive', '==', true));
        const activeCouponsSnapshot = await getDocs(activeCouponsQuery);
        setActiveCoupons(activeCouponsSnapshot.size);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [firestore]);


  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">All-time revenue</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">+{totalSales}</div>
                <p className="text-xs text-muted-foreground">All-time transactions</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">Items in inventory</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Coupons</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? (
              <div className="text-2xl font-bold">...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{activeCoupons}</div>
                <p className="text-xs text-muted-foreground">Currently active promotions</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="col-span-1 lg:col-span-2 xl:col-span-3">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Your sales over the last 12 months.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
             <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={monthlySales}>
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                   <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar
                    dataKey="total"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-1 xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>
              Your last {recentSales?.length || 0} transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentSalesLoading && <p>Loading...</p>}
            {recentSales?.length === 0 && !recentSalesLoading && <p className="text-sm text-muted-foreground">No recent sales found.</p>}
            <div className="space-y-8">
              {recentSales?.map(sale => (
                <div className="flex items-center" key={sale.id}>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={`https://i.pravatar.cc/150?u=${sale.cashierId}`} alt="Avatar" />
                    <AvatarFallback>{sale.cashierName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">{sale.cashierName || 'Anonymous'}</p>
                    <p className="text-sm text-muted-foreground truncate">{sale.id}</p>
                  </div>
                  <div className="ml-auto font-medium">${sale.totalAmount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}