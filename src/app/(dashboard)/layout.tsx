'use client';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader as AppSidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarInset,
} from '@/components/ui/sidebar';
import { DashboardNav } from '@/components/dashboard-nav';
import { Logo } from '@/components/icons';
import { AuthorizationProvider } from '@/hooks/use-authorization';
import { LoadingIndicator } from '@/components/ui/loading-indicator';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Wait until the client is hydrated and the user loading is complete
    if (isClient && !isUserLoading) {
      const permissions = sessionStorage.getItem('userPermissions');
      // If there's no user or no permissions, redirect to login.
      if (!user || !permissions) {
        // Avoid redirecting if we are already on the login page (though this layout shouldn't cover it)
        if (pathname !== '/login') {
          router.replace('/login');
        }
      }
    }
  }, [user, isUserLoading, isClient, router, pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem('userPermissions');
    auth?.signOut();
  };

  // Show a loading screen while we wait for the client to hydrate or for the user status to be determined.
  if (!isClient || isUserLoading) {
    return <LoadingIndicator fullScreen />;
  }
  
  // If, after loading, we find there's no user or permissions, continue showing the loader
  // while the useEffect above handles the redirect to the login page. This prevents the layout from flashing.
  if (!user || !sessionStorage.getItem('userPermissions')) {
    return <LoadingIndicator fullScreen />;
  }
  
  return (
    <AuthorizationProvider>
      <SidebarProvider>
        <div className="grid min-h-screen w-full md:grid-cols-[auto_1fr]">
          <Sidebar collapsible="icon">
            <AppSidebarHeader>
              <Link
                href="/pos"
                className="flex items-center justify-center gap-2 font-semibold h-14"
              >
                <Logo className="h-6 w-6" />
                <span className="text-lg group-data-[collapsible=icon]:hidden">UrbanPOS</span>
              </Link>
            </AppSidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <DashboardNav />
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          <div className="flex flex-col">
            <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="hidden md:flex" />
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 md:hidden"
                    >
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="flex flex-col bg-sidebar text-sidebar-foreground"
                  >
                    <SheetHeader className="sr-only">
                        <SheetTitle>Mobile Navigation Menu</SheetTitle>
                        <SheetDescription>
                        A list of links to navigate the UrbanPOS application.
                        </SheetDescription>
                    </SheetHeader>
                    <AppSidebarHeader>
                      <Link
                        href="/pos"
                        className="flex items-center gap-2 font-semibold"
                      >
                        <Logo className="h-6 w-6" />
                        <span className="text-lg">UrbanPOS</span>
                      </Link>
                    </AppSidebarHeader>
                    <SidebarContent>
                      <SidebarMenu onClick={() => setIsMobileSheetOpen(false)}>
                        <DashboardNav />
                      </SidebarMenu>
                    </SidebarContent>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="w-full flex-1" />
              <Button onClick={handleLogout}>Logout</Button>
            </header>
            <SidebarInset>
              <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background">
                {children}
              </main>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
    </AuthorizationProvider>
  );
}
