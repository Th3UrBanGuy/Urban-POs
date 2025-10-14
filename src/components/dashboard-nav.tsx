'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart2,
  Home,
  Package,
  Settings,
  Receipt,
  Tag,
} from 'lucide-react';

import {
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAuthorization } from '@/hooks/use-authorization';

const navLinks = [
  { href: '/pos', label: 'POS', icon: Receipt, exact: true, permission: 'pos' },
  { href: '/dashboard', label: 'Dashboard', icon: Home, exact: true, permission: 'dashboard' },
  { href: '/sales', label: 'Sales', icon: BarChart2, permission: 'sales' },
  { href: '/inventory', label: 'Inventory', icon: Package, permission: 'inventory' },
  { href: '/coupons', label: 'Coupons', icon: Tag, permission: 'coupons' },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings' },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { hasPermission } = useAuthorization();
  
  const accessibleLinks = navLinks.filter(link => hasPermission(link.permission));

  return (
    <>
      {accessibleLinks.map((link) => {
        const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <SidebarMenuItem asChild key={link.href}>
            <Link href={link.href} prefetch={true}>
              <SidebarMenuButton
                isActive={isActive}
                tooltip={link.label}
                size="lg"
              >
                <link.icon />
                <span>{link.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}
