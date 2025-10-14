'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthorization } from '@/hooks/use-authorization';
import { Button } from '@/components/ui/button';

const firstAccessiblePage = (permissions: any): string => {
    const orderedPages = ['pos', 'dashboard', 'sales', 'inventory', 'coupons', 'settings'];
    if (permissions?.isMaster) {
        return '/pos';
    }
    const accessiblePage = orderedPages.find(page => permissions?.pages.includes(page));
    return accessiblePage ? `/${accessiblePage}` : '/login';
};

export default function UnauthorizedPage() {
    const router = useRouter();
    const { permissions } = useAuthorization();

    const accessiblePage = firstAccessiblePage(permissions);

    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace(accessiblePage);
        }, 3000);

        return () => clearTimeout(timer);
    }, [router, accessiblePage]);

    const handleRedirectNow = () => {
        router.replace(accessiblePage);
    };

    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit">
                        <ShieldAlert className="h-8 w-8" />
                    </div>
                    <CardTitle className="mt-4">Access Denied</CardTitle>
                    <CardDescription>
                        You do not have permission to view this page. You will be redirected shortly.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Redirecting to a page you can access...
                    </p>
                    <Button onClick={handleRedirectNow}>
                        Redirect Now
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
