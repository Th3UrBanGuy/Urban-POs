'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, KeyRound, Copy, Check, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import type { AccessKey } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';


const masterKeyFormSchema = z.object({
  masterKey: z.string().min(1, 'Master key cannot be empty.'),
});

const PERMISSIONS = [
  { id: 'pos', label: 'POS' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'sales', label: 'Sales' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'settings', label: 'Settings' },
] as const;


const keyFormSchema = z.object({
  tagName: z.string().min(1, 'Tag Name is required.'),
  key: z.string().min(6, 'Key must be at least 6 characters.'),
  isMasterKey: z.boolean(),
  permissions: z.array(z.string()).refine(value => value.some(item => item), {
    message: "You have to select at least one permission.",
  }).optional(),
}).refine(data => data.isMasterKey || (data.permissions && data.permissions.length > 0), {
    message: "You must select at least one permission if it's not a master key.",
    path: ["permissions"],
});


export default function AccessKeysPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const superMasterKey = "726268";

  const keysCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'accessKeys') : null),
    [firestore]
  );
  const { data: accessKeys, isLoading } = useCollection<AccessKey>(keysCollection);

  const unlockForm = useForm<z.infer<typeof masterKeyFormSchema>>({
    resolver: zodResolver(masterKeyFormSchema),
    defaultValues: { masterKey: '' },
  });
  
  const keyForm = useForm<z.infer<typeof keyFormSchema>>({
    resolver: zodResolver(keyFormSchema),
    defaultValues: {
      tagName: '',
      key: '',
      isMasterKey: false,
      permissions: ['pos'],
    },
  });

  const onUnlockSubmit = async (values: z.infer<typeof masterKeyFormSchema>) => {
    if (values.masterKey === superMasterKey) {
        setIsUnlocked(true);
        toast({ title: 'Access Granted', description: 'Super master key used.' });
        return;
    }
    
    if (!keysCollection) {
        toast({ variant: 'destructive', title: 'Error', description: 'Database connection not available.' });
        return;
    }
    const q = query(keysCollection, where('key', '==', values.masterKey), where('isMasterKey', '==', true));
    
    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            setIsUnlocked(true);
            toast({ title: 'Access Granted', description: 'You can now manage access keys.' });
        } else {
            unlockForm.setError('masterKey', { type: 'manual', message: 'Incorrect master key.' });
            toast({ variant: 'destructive', title: 'Access Denied', description: 'The provided key is not a valid master key.' });
        }
    } catch (error) {
        console.error('Error verifying master key:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while verifying the key.' });
    }
  };
  
  const handleAddKey = (values: z.infer<typeof keyFormSchema>) => {
    startTransition(async () => {
        if (!keysCollection) return;
        
        const newKey = values.key || ''; // Should always be present based on schema
        if (!newKey) {
            toast({ variant: 'destructive', title: 'Error', description: 'Key is required.' });
            return;
        }

        try {
            const newKeyData = {
                tagName: values.tagName,
                key: newKey,
                isMasterKey: values.isMasterKey,
                permissions: values.isMasterKey ? PERMISSIONS.map(p => p.id) : values.permissions || [],
                createdAt: new Date().toISOString(),
            };
            await addDocumentNonBlocking(keysCollection, newKeyData);
            toast({ title: 'Key Created', description: `New key ${newKey} has been created.` });
            keyForm.reset();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create key.' });
        }
    })
  }

  const handleDeleteKey = (keyId: string) => {
    if (!firestore) return;
    const keyDocRef = doc(firestore, 'accessKeys', keyId);
    deleteDocumentNonBlocking(keyDocRef);
    toast({ title: "Key Deleted", description: "The access key has been removed." });
  }

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
        setCopiedKey(key);
        toast({ title: 'Copied!', description: 'Access key copied to clipboard.' });
        setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Master Key Required</CardTitle>
            <CardDescription>Enter a master key to manage all access keys.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...unlockForm}>
              <form onSubmit={unlockForm.handleSubmit(onUnlockSubmit)} className="space-y-4">
                <FormField
                  control={unlockForm.control}
                  name="masterKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter Master Key"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={unlockForm.formState.isSubmitting}>
                   {unlockForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Unlock
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const KeyFormFields = () => {
    const form = keyForm;
    const isMaster = form.watch('isMasterKey');
  
    return (
      <>
        <FormField
          control={form.control}
          name="tagName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tag Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Main Cashier" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
            control={form.control}
            name="key"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Access Key</FormLabel>
                <FormControl>
                <Input placeholder="e.g., CASHIER01" {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
  
        <FormField
          control={form.control}
          name="isMasterKey"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Master Key</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Grants full access to all features.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
  
        {!isMaster && (
          <FormField
            control={form.control}
            name="permissions"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Permissions</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Select which pages this key can access.
                  </p>
                </div>
                <div className="space-y-2">
                  {PERMISSIONS.map((item) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name="permissions"
                      render={({ field }) => (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-center space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(item.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), item.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== item.id
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal capitalize">
                            {item.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Access Keys</CardTitle>
                    <CardDescription>Manage keys and their permissions for POS access.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tag Name</TableHead>
                                <TableHead>Access Key</TableHead>
                                <TableHead>Permissions</TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && <TableRow><TableCell colSpan={5}>Loading keys...</TableCell></TableRow>}
                            {accessKeys?.map((accessKey) => (
                                <TableRow key={accessKey.id}>
                                    <TableCell className="font-medium">{accessKey.tagName}</TableCell>
                                    <TableCell className="font-mono flex items-center gap-2">
                                    {accessKey.isMasterKey ? <ShieldCheck className="h-4 w-4 text-green-500"/> : <KeyRound className="h-4 w-4 text-muted-foreground"/>}
                                    {accessKey.key}
                                    </TableCell>
                                    <TableCell className="max-w-xs">
                                        <div className="flex flex-wrap gap-1">
                                            {accessKey.isMasterKey ? (
                                                <Badge variant="default">Master Access</Badge>
                                            ) : (
                                                accessKey.permissions.map(p => <Badge variant="secondary" key={p}>{p}</Badge>)
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{new Date(accessKey.createdAt).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(accessKey.key)}>
                                            {copiedKey === accessKey.key ? <Check className="h-4 w-4 text-green-500"/> : <Copy className="h-4 w-4" />}
                                        </Button>
                                         <Button variant="ghost" size="icon" onClick={() => handleDeleteKey(accessKey.id)} disabled={accessKey.isMasterKey}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Create New Key</CardTitle>
                    <CardDescription>Define a new key and assign permissions.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Form {...keyForm}>
                        <form onSubmit={keyForm.handleSubmit(handleAddKey)} className="space-y-6">
                           <KeyFormFields />
                            <Button type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Create Access Key
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
