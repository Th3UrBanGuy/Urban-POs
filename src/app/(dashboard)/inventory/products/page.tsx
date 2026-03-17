'use client';

import Image from 'next/image';
import Link from 'next/link';
import { PlusCircle, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Product } from '@/lib/data';

function getStockStatus(stock: number): 'In Stock' | 'Low Stock' | 'Out of Stock' {
    if (stock === 0) return 'Out of Stock';
    if (stock <= 10) return 'Low Stock';
    return 'In Stock';
}

function getBadgeVariant(status: 'In Stock' | 'Low Stock' | 'Out of Stock'): 'default' | 'secondary' | 'destructive' {
    switch (status) {
        case 'In Stock':
            return 'default';
        case 'Low Stock':
            return 'secondary';
        case 'Out of Stock':
            return 'destructive';
    }
}


export default function InventoryProductsPage() {
  const firestore = useFirestore();
  const productsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'products') : null),
    [firestore]
  );
  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Products</CardTitle>
            <CardDescription>Manage your products and view their inventory status.</CardDescription>
        </div>
        <Button asChild size="sm" className="gap-1">
          <Link href="/inventory/add">
            <PlusCircle className="h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-[100px] sm:table-cell">
                <span className="sr-only">Image</span>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Price</TableHead>
              <TableHead className="hidden md:table-cell">
                Stock
              </TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>}
            {products?.map((product) => {
                const stockStatus = getStockStatus(product.stockQuantity);
                const badgeVariant = getBadgeVariant(stockStatus);
              return (
                <TableRow key={product.id}>
                  <TableCell className="hidden sm:table-cell">
                    <Image
                      alt={product.name}
                      className="aspect-square rounded-md object-cover"
                      height="64"
                      src={product.imageUrl}
                      width="64"
                      data-ai-hint={product.imageHint}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant}>{stockStatus}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">${product.price.toFixed(2)}</TableCell>
                  <TableCell className="hidden md:table-cell">{product.stockQuantity}</TableCell>
                   <TableCell>
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/inventory/products/edit/${product.id}`}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
