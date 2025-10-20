'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth, useUser, initiateAnonymousSignIn } from '@/firebase';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { KeyRound, User as UserIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AccessKey } from '@/lib/data';
import { LoadingIndicator } from '@/components/ui/loading-indicator';


export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [accessKey, setAccessKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const masterKey = "726268";

  const accessKeysCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'accessKeys') : null),
    [firestore]
  );
  
  useEffect(() => {
    // Redirect if user is logged in AND has permissions.
    // This allows a new login to proceed if permissions are cleared from a previous session.
    if (!isUserLoading && user && sessionStorage.getItem('userPermissions')) {
      router.push('/pos');
    }
  }, [user, isUserLoading, router]);

  const handleSuccessfulLogin = async (keyData: Partial<AccessKey>) => {
      const permissions = {
        isMaster: keyData.isMasterKey || false,
        pages: keyData.permissions || [],
        tagName: keyData.tagName || (keyData.isMasterKey ? 'Master' : 'Unnamed Key'),
      };
      sessionStorage.setItem('userPermissions', JSON.stringify(permissions));
      if (auth) {
        await initiateAnonymousSignIn(auth);
        router.push('/pos');
      }
    };

  const handleLogin = async () => {
    setIsProcessing(true);
    
    // Clear any previous session permissions
    sessionStorage.removeItem('userPermissions');

    if (accessKey === masterKey) {
      handleSuccessfulLogin({ isMasterKey: true, tagName: 'Master Key' });
      // No need to set isProcessing to false, as the useEffect will redirect
      return;
    }

    if (!accessKeysCollection) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not connect to database.' });
      setIsProcessing(false);
      return;
    }

    try {
        const q = query(accessKeysCollection, where('key', '==', accessKey));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const keyDoc = querySnapshot.docs[0];
            const keyData = keyDoc.data() as AccessKey;
            handleSuccessfulLogin(keyData);
            // The useEffect hook will now handle redirection once the user state changes.
        } else {
            toast({ variant: 'destructive', title: 'Invalid Key', description: 'The provided access key is not valid.' });
            setIsProcessing(false);
        }
    } catch(e) {
        console.error("Login Error:", e);
        toast({ variant: 'destructive', title: 'Login Error', description: 'An error occurred during login.' });
        setIsProcessing(false);
    }
  };

  // This loading state handles the initial page load before we know if a user is already signed in.
  if (isUserLoading) {
    return (
        <LoadingIndicator fullScreen isLoginPage />
    );
  }

  // This condition prevents flashing the login page if a user is already authenticated and has permissions.
  // The useEffect hook will handle the redirect shortly.
  if (user && sessionStorage.getItem('userPermissions')) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gradient-login text-white">
            <p className="text-xl font-semibold">Redirecting</p>
            <div className="flex items-center justify-center space-x-2">
                <div className="h-3 w-3 rounded-full bg-white animate-redirect-dot-1"></div>
                <div className="h-3 w-3 rounded-full bg-white animate-redirect-dot-2"></div>
                <div className="h-3 w-3 rounded-full bg-white animate-redirect-dot-3"></div>
            </div>
        </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-login p-4">
      <div className="relative w-full max-w-md">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 text-white shadow-2xl rounded-2xl pt-8">
          <CardHeader className="items-center">
             <UserIcon className="h-16 w-16 text-white" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-300" />
              <Input
                id="accessKey"
                type="password"
                placeholder="Access Key"
                required
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                className="bg-slate-700/50 border-white/30 pl-10 text-white placeholder:text-gray-300 focus:ring-offset-slate-900"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 mt-4">
            <Button
              className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold text-base py-6 rounded-xl shadow-lg border border-white/10"
              onClick={handleLogin}
              disabled={isProcessing}
            >
              {isProcessing ? 'VERIFYING...' : 'LOGIN'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
