'use client';

import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Package, Folder } from 'lucide-react';

const inventorySections = [
  {
    title: 'Manage Products',
    description: 'View, edit, search, and manage all your products.',
    href: '/inventory/products',
    icon: Package,
  },
  {
    title: 'Manage Categories',
    description: 'Organize your products by creating and managing categories.',
    href: '/inventory/categories',
    icon: Folder,
  },
];

export default function InventoryPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
        <p className="text-muted-foreground">
          Your central hub for products and categories.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {inventorySections.map((section) => (
          <Link href={section.href} key={section.title} className="group">
            <Card className="flex flex-col h-full transition-all duration-200 group-hover:border-primary group-hover:shadow-lg">
              <CardHeader className="flex-row items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <section.icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription>{section.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
