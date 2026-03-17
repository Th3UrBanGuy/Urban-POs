import { getAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AuthorizationProvider } from '@/hooks/use-authorization';
import DashboardShell from '@/components/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  
  // Extra safety net: If somehow middleware missed it, Server Component blocks it.
  if (!session) {
    redirect('/login');
  }

  return (
    <AuthorizationProvider initialPermissions={session}>
      <DashboardShell>{children}</DashboardShell>
    </AuthorizationProvider>
  );
}
