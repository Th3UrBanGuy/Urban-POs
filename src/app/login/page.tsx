'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { KeyRound, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loginWithKey } from '@/app/actions';

export default function LoginPage() {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const { toast } = useToast();

  const handleLogin = async () => {
    setIsProcessing(true);

    try {
      // 1. Validates the key & sets the HTTP-only secure cookie
      const result = await loginWithKey(accessKey);

      if (!result.success) {
        toast({ variant: 'destructive', title: 'Login Failed', description: result.message });
        setIsProcessing(false);
        return;
      }

      setLoginSuccess(true);
      
      // 2. The cookie is now set. Middleware will allow this transition without checking Firebase.
      router.replace('/pos');
    } catch {
      setLoginSuccess(false);
      setIsProcessing(false);
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    }
  };

  // ── Post-login: show redirect indicator while navigating ───────────────────
  if (loginSuccess) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-900 text-white">
        <p className="text-xl font-semibold">Authenticating...</p>
        <div className="flex items-center justify-center space-x-2">
          <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
          <div className="h-3 w-3 rounded-full bg-white animate-pulse [animation-delay:0.2s]" />
          <div className="h-3 w-3 rounded-full bg-white animate-pulse [animation-delay:0.4s]" />
        </div>
      </div>
    );
  }

  // ── Login form ─────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="relative w-full max-w-sm">
        <Card className="bg-black/30 backdrop-blur-xl border border-white/10 text-white shadow-2xl rounded-3xl">
          <CardHeader className="items-center text-center pt-8 pb-4">
            <div className="p-3 bg-white/10 rounded-full mb-4 border border-white/10">
              <Building className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-wider">Urban POS</h1>
            <p className="text-sm text-gray-300">Access Your Dashboard</p>
          </CardHeader>
          <CardContent className="grid gap-6 px-8">
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="accessKey"
                type="password"
                placeholder="Enter Access Key"
                required
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                className="bg-black/40 border-white/20 pl-12 text-lg text-white placeholder:text-gray-400 focus:ring-offset-gray-800 rounded-xl h-14"
                onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleLogin()}
              />
            </div>
          </CardContent>
          <CardFooter className="px-8 pb-8 pt-4">
            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 backdrop-blur-sm text-white font-bold text-lg py-7 rounded-xl shadow-lg border border-white/10 transition-all duration-300 ease-in-out transform hover:scale-105"
              onClick={handleLogin}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                  Verifying...
                </div>
              ) : (
                'Login'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}