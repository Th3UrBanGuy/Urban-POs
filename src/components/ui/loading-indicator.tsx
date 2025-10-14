import { Logo } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function LoadingIndicator({
  className,
  fullScreen = false,
  isLoginPage = false,
}: {
  className?: string;
  fullScreen?: boolean;
  isLoginPage?: boolean;
}) {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Mount the animation only on the client to avoid hydration errors
    const timer = setTimeout(() => setShowText(true), 10); // small delay to ensure it runs after mount
    return () => clearTimeout(timer);
  }, []);

  const textColor = isLoginPage ? 'text-white' : 'text-foreground';
  const logoColor = isLoginPage ? 'text-white' : 'text-primary';
  const pulseColor = isLoginPage ? 'bg-white/20' : 'bg-primary/20';
  const bgColor = isLoginPage ? 'bg-gradient-login' : 'bg-background';

  if (fullScreen) {
    return (
      <div className={cn("flex h-screen w-full flex-col items-center justify-center gap-4", bgColor)}>
        <div className="relative flex animate-pulse items-center justify-center">
          <Logo className={cn("h-16 w-16", logoColor)} />
          <div className={cn("absolute inline-flex h-24 w-24 rounded-full", pulseColor)}></div>
        </div>
        {showText && (
            <div className={cn("text-center text-2xl font-bold tracking-wider", textColor)}>
                <span className="animate-fade-in-word-1">Urban</span>
                <span className="animate-fade-in-word-2">POS</span>
            </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center space-x-2', className)}
    >
      <div className="relative flex animate-pulse items-center justify-center">
        <Logo className="h-8 w-8 text-primary" />
        <div className="absolute inline-flex h-12 w-12 rounded-full bg-primary/20"></div>
      </div>
    </div>
  );
}
