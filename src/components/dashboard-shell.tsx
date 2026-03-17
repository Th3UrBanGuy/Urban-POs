'use client';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useAuth, initiateAnonymousSignIn, useUser } from '@/firebase';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
import { logoutAction } from '@/app/actions';

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  // ── Firebase Anonymous Auth (Background) ──
  // Instead of blocking login, we do it passively here in the dashboard 
  // to establish the persistent connection required for Firestore streams.
  useEffect(() => {
    if (auth && !user) {
      initiateAnonymousSignIn(auth).catch((err) => {
         console.warn("Passive anonymous auth failed:", err);
      });
    }
  }, [auth, user]);

  const handleLogout = async () => {
    sessionStorage.removeItem('userPermissions'); // keep as a fallback cleanup
    await logoutAction(); // clears the HTTP-only session cookie
    auth?.signOut();
    router.replace('/login');
  };

  return (
      <SidebarProvider>
        <div className="grid min-h-screen w-full md:grid-cols-[auto_1fr] bg-slate-200 dark:bg-black font-sans">
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
          <div className="flex flex-col w-full overflow-hidden bg-slate-100 dark:bg-slate-950/80 shadow-[inset_10px_0_20px_rgba(0,0,0,0.05)] border-l border-slate-300 dark:border-slate-800 rounded-l-2xl">
            <header className="flex h-16 items-center gap-4 border-b-2 border-slate-300 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-lg px-4 lg:h-[72px] lg:px-6 w-full z-10 sticky top-0 shadow-sm">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="hidden md:flex bg-white dark:bg-slate-800 shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:shadow-none hover:translate-y-[1px] rounded-lg transition-all" />
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 md:hidden bg-white dark:bg-slate-800 shadow-[0_3px_0_theme(colors.slate.300)] dark:shadow-[0_3px_0_theme(colors.slate.700)] active:shadow-none active:translate-y-[3px] border-2"
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
              <Button onClick={handleLogout} variant="outline" className="border-2 shadow-[0_3px_0_theme(colors.slate.300)] dark:shadow-[0_3px_0_theme(colors.slate.700)] active:shadow-none active:translate-y-[3px]">
                Logout
              </Button>
            </header>
            <SidebarInset className="w-full flex-1 overflow-x-hidden bg-transparent">
              <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-8">
                {children}
              </main>
            </SidebarInset>
          </div>
        </div>
      </SidebarProvider>
  );
}
