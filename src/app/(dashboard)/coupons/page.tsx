'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays, format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Coupon } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const formSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters.'),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().min(0.01, 'Discount value must be positive.'),
  expirationDate: z.date({
    required_error: "An expiration date is required.",
  }),
  usageLimit: z.coerce.number().min(1, 'Usage limit must be at least 1.'),
});

export default function CouponsPage() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();

  const couponsCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'coupons') : null),
    [firestore]
  );
  
  const { data: coupons, isLoading } = useCollection<Coupon>(couponsCollection);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      discountType: 'percentage',
      discountValue: 10,
      usageLimit: 100,
      expirationDate: addDays(new Date(), 30),
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      if (!couponsCollection) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Firestore not initialized.',
        });
        return;
      }
      try {
        const couponData = {
          ...values,
          code: values.code.toUpperCase(),
          expirationDate: values.expirationDate.toISOString(),
          isActive: true,
          usageCount: 0,
        };
        await addDocumentNonBlocking(couponsCollection, couponData);
        toast({
          title: 'Coupon Added',
          description: `Coupon ${couponData.code} has been successfully created.`,
        });
        form.reset();
      } catch (error) {
        console.error('Error adding coupon:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to add coupon. Please try again.',
        });
      }
    });
  };
  
  const getCouponStatus = (coupon: Coupon): 'Active' | 'Expired' | 'Used Up' | 'Inactive' => {
    if (!coupon.isActive) return 'Inactive';
    if (new Date(coupon.expirationDate) < new Date()) return 'Expired';
    if (coupon.usageCount >= coupon.usageLimit) return 'Used Up';
    return 'Active';
  }

  const getStatusBadgeVariant = (status: 'Active' | 'Expired' | 'Used Up' | 'Inactive') => {
      switch (status) {
          case 'Active': return 'default';
          case 'Inactive': return 'secondary';
          case 'Expired':
          case 'Used Up':
            return 'destructive';
      }
  }


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Coupons</CardTitle>
            <CardDescription>Manage your promotional coupons.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>}
                {coupons?.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  const badgeVariant = getStatusBadgeVariant(status);
                  return (
                    <TableRow key={coupon.id}>
                        <TableCell className="font-medium">{coupon.code}</TableCell>
                        <TableCell>
                            {coupon.discountType === 'fixed' ? `$${coupon.discountValue.toFixed(2)}` : `${coupon.discountValue}%`}
                        </TableCell>
                        <TableCell>{coupon.usageCount} / {coupon.usageLimit}</TableCell>
                        <TableCell>{new Date(coupon.expirationDate).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant={badgeVariant}>{status}</Badge></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Add New Coupon</CardTitle>
            <CardDescription>
              Create a new coupon for your store.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coupon Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., SUMMER24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="grid grid-cols-3 gap-4">
                    <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                        <FormItem className="col-span-1">
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="percentage">Percentage</SelectItem>
                                <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                        control={form.control}
                        name="discountValue"
                        render={({ field }) => (
                            <FormItem className="col-span-2">
                            <FormLabel>Value</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g., 10 or 15.50" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="usageLimit"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Usage Limit</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 100" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiration Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Coupon
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    