'use client';

import { useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Info, Receipt, KeyRound, Globe } from 'lucide-react';
import Link from 'next/link';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useDoc, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Settings } from '@/lib/data';
import { syncExchangeRates } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const settingsFormSchema = z.object({
  storeName: z.string().min(1, 'Store name is required.'),
  storeAddress: z.string().min(1, 'Store address is required.'),
  storeEmail: z.string().email('Please enter a valid email.'),
  defaultTaxRate: z.coerce.number().min(0, 'Tax rate cannot be negative.').max(100, 'Tax rate cannot exceed 100.'),
  receiptFooterMessage: z.string().optional(),
  baseCurrency: z.string().min(3, "Base currency must be a 3-letter code.").max(3, "Base currency must be a 3-letter code."),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function SettingsPage() {
  const [isSyncing, startSyncTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();

  const settingsDocRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'settings', 'store-settings') : null),
    [firestore]
  );
  const { data: settings, isLoading: isLoadingSettings } = useDoc<Settings>(settingsDocRef);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      storeName: 'UrbanPOS',
      storeAddress: '123 Market St, San Francisco, CA 94103',
      storeEmail: 'contact@urbanpos.com',
      defaultTaxRate: 10,
      receiptFooterMessage: 'Thank you for shopping with us!',
      baseCurrency: 'USD',
    },
  });
  
  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);
  
  const onSubmit = (values: SettingsFormValues) => {
    startSaveTransition(() => {
        if (!settingsDocRef) {
            toast({ variant: "destructive", title: "Error", description: "Firestore not available." });
            return;
        }

        setDocumentNonBlocking(settingsDocRef, { ...values, baseCurrency: values.baseCurrency.toUpperCase() }, { merge: true });
        toast({
            title: 'Settings Saved',
            description: 'Your store settings have been successfully updated.',
        });
    });
  };

  const handleSyncRates = () => {
    startSyncTransition(async () => {
        const result = await syncExchangeRates();
        if (result.success) {
            toast({
                title: 'Success',
                description: result.message,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Sync Failed',
                description: result.message,
            });
        }
    });
  };
  
  const isPending = isSyncing || isSaving;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your store settings and preferences.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
               <Card>
                <CardHeader className="flex-row items-start gap-4">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-700"><Info className="h-5 w-5" /></div>
                  <div>
                    <CardTitle>Store Information</CardTitle>
                    <CardDescription>Update your store's public details.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="storeName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Store Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storeAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storeEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input placeholder="contact@yourstore.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-start gap-4">
                   <div className="p-3 rounded-full bg-purple-100 text-purple-700"><Receipt className="h-5 w-5" /></div>
                    <div>
                      <CardTitle>Point of Sale & Receipt</CardTitle>
                      <CardDescription>Configure POS-specific settings.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="defaultTaxRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Tax Rate (%)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 8.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="receiptFooterMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receipt Footer Message</FormLabel>
                        <FormControl>
                          <Textarea placeholder="A short message to appear at the bottom of receipts." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

               <Card>
                  <CardHeader className="flex-row items-start gap-4">
                    <div className="p-3 rounded-full bg-green-100 text-green-700"><Globe className="h-5 w-5" /></div>
                    <div>
                      <CardTitle>Currency & Exchange Rates</CardTitle>
                      <CardDescription>Manage currency settings and sync exchange rates.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                     <FormField
                      control={form.control}
                      name="baseCurrency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Currency (for product pricing)</FormLabel>
                           <FormControl>
                            <Input placeholder="e.g., USD" {...field} />
                          </FormControl>
                           <FormDescription>All product prices in your inventory should be in this currency.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="text-sm font-medium">Exchange Rates</p>
                        <p className="text-xs text-muted-foreground">
                            Last synced: {settings?.lastCurrencySync ? new Date(settings.lastCurrencySync).toLocaleString() : 'Never'}
                        </p>
                        <Button type="button" onClick={handleSyncRates} disabled={isSyncing}>
                            {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Sync Exchange Rates
                        </Button>
                    </div>
                  </CardContent>
                </Card>

              <Card>
                <CardHeader className="flex-row items-start gap-4">
                  <div className="p-3 rounded-full bg-amber-100 text-amber-700"><KeyRound className="h-5 w-5" /></div>
                  <div>
                    <CardTitle>Access Keys</CardTitle>
                    <CardDescription>Manage keys for accessing the POS system.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href="/settings/keys">Manage Access Keys</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              {/* Empty column */}
            </div>
          </div>
          

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || isLoadingSettings} size="lg">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All Settings
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
