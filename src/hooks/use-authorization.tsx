'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import UnauthorizedPage from '@/app/(dashboard)/unauthorized/page';

type PagePermission = 'pos' | 'dashboard' | 'sales' | 'inventory' | 'coupons' | 'settings';

interface UserPermissions {
  isMaster: boolean;
  pages: PagePermission[];
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

function getPermissionsFromStorage(): UserPermissions | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem('userPermissions');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (typeof parsed.isMaster === 'boolean' && Array.isArray(parsed.pages)) {
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse user permissions from sessionStorage", e);
      return null;
    }
  }
  return null;
}

export const AuthorizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const permissions = useMemo(() => {
    if (!isClient) return null;
    return getPermissionsFromStorage();
  }, [isClient]);

  const hasPermission = (page: PagePermission): boolean => {
    if (!permissions) return false;
    if (permissions.isMaster) return true;
    return permissions.pages.includes(page);
  };
  
  const isAuthorized = useMemo(() => {
    if (!isClient || !permissions) {
      // While waiting for client-side hydration or if no permissions exist at all,
      // the parent layout's loading state should be showing.
      // We authorize here to prevent rendering UnauthorizedPage prematurely.
      return true;
    }
    
    // Allow access to the unauthorized page itself.
    if (pathname === '/unauthorized') {
        return true;
    }

    const requiredPermission = Object.entries(pagePermissionMap).find(([pathPrefix]) => pathname.startsWith(pathPrefix))?.[1];

    if (requiredPermission) {
      return hasPermission(requiredPermission);
    }
    
    // If no specific permission is required for the route, allow access.
    return true;
  }, [pathname, permissions, isClient]);

  if (!isClient) {
    // Render nothing during SSR, the main layout should show a loading state.
    return null;
  }
  
  if (!permissions) {
     // This case is handled by the main layout redirecting to /login.
     // Returning null prevents content flashing.
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
