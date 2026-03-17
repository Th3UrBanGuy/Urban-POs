'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import UnauthorizedPage from '@/app/(dashboard)/unauthorized/page';

type PagePermission = 'pos' | 'dashboard' | 'sales' | 'inventory' | 'coupons' | 'settings';

export interface UserPermissions {
  isMaster: boolean;
  pages: string[];
  tagName?: string;
}

interface AuthorizationContextType {
  permissions: UserPermissions | null;
  hasPermission: (page: PagePermission) => boolean;
}

const AuthorizationContext = createContext<AuthorizationContextType | undefined>(undefined);

const pagePermissionMap: Record<string, PagePermission> = {
  '/pos': 'pos',
  '/dashboard': 'dashboard',
  '/sales': 'sales',
  '/inventory': 'inventory',
  '/coupons': 'coupons',
  '/settings': 'settings',
};

export const AuthorizationProvider: React.FC<{ 
  children: ReactNode, 
  initialPermissions: UserPermissions | null 
}> = ({ children, initialPermissions }) => {
  const pathname = usePathname();

  const permissions = initialPermissions;

  const hasPermission = (page: PagePermission): boolean => {
    if (!permissions) return false;
    if (permissions.isMaster) return true;
    return permissions.pages.includes(page);
  };

  const isAuthorized = useMemo(() => {
    // If we're rendering this provider inside the dashboard layout, there should ideally be permissions.
    // If they were wiped mid-session, we block rendering (middleware will catch them on reload).
    if (!permissions) {
      return false; 
    }

    // Allow access to the unauthorized page itself.
    if (pathname === '/unauthorized') {
      return true;
    }

    const requiredPermission = Object.entries(pagePermissionMap).find(([pathPrefix]) => pathname.startsWith(pathPrefix))?.[1];

    if (requiredPermission) {
      if (permissions.isMaster) return true;
      return permissions.pages.includes(requiredPermission);
    }

    // If no specific permission is required for the route, allow access.
    return true;
  }, [pathname, permissions]);


  if (!permissions) {
    // This case is handled by the main layout redirecting or the middleware.
    return null;
  }

  const value = { permissions, hasPermission };

  return (
    <AuthorizationContext.Provider value={value}>
      {isAuthorized ? children : <UnauthorizedPage />}
    </AuthorizationContext.Provider>
  );
};


export const useAuthorization = (): AuthorizationContextType => {
  const context = useContext(AuthorizationContext);
  if (context === undefined) {
    throw new Error('useAuthorization must be used within an AuthorizationProvider');
  }
  return context;
};
