'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingIndicator } from '@/components/ui/loading-indicator';

/**
 * /setup page - Redirects to /login.
 * The master key is now configured via the MASTER_KEY environment variable.
 * See README or your hosting platform's secrets management to configure it.
 */
export default function SetupPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/login');
    }, [router]);

    return <LoadingIndicator fullScreen />;
}
