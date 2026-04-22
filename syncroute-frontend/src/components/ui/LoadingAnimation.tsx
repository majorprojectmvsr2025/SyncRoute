import { useEffect, useState } from 'react';
import { Car } from 'lucide-react';

interface LoadingAnimationProps {
  message?: string;
  subMessage?: string;
  onComplete?: () => void;
  duration?: number;
}

export function LoadingAnimation({ 
  message = "Processing Request", 
  subMessage = "Synchronizing with server",
  onComplete,
  duration = 3000 
}: LoadingAnimationProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onComplete) {
            setTimeout(onComplete, 300);
          }
          return 100;
        }
        return prev + (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
      {/* Animated Car Icon */}
      <div className="relative mb-8">
        <div className="animate-bounce">
          <div className="relative">
            {/* Car Icon */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-primary rounded-2xl flex items-center justify-center shadow-2xl">
              <Car className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-primary-foreground" />
            </div>
            
            {/* Spinning wheel effect */}
            <div className="absolute -bottom-2 -left-2 w-6 h-6 sm:w-8 sm:h-8 bg-foreground rounded-full animate-spin border-4 border-background" />
            <div className="absolute -bottom-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 bg-foreground rounded-full animate-spin border-4 border-background" style={{ animationDelay: '0.1s' }} />
          </div>
        </div>
        
        {/* Speed lines */}
        <div className="absolute top-1/2 -left-20 sm:-left-24 md:-left-32 -translate-y-1/2 space-y-2 opacity-50">
          <div className="h-1 w-12 sm:w-16 md:w-20 bg-primary rounded-full animate-pulse" />
          <div className="h-1 w-8 sm:w-12 md:w-16 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="h-1 w-10 sm:w-14 md:w-18 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>

      {/* Content */}
      <div className="text-center space-y-4 max-w-md w-full">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {message}
        </h1>
        <p className="text-muted-foreground font-light tracking-widest uppercase text-xs">
          {subMessage}
        </p>

        {/* Progress Bar */}
        <div className="w-full max-w-xs mx-auto mt-8">
          <div className="h-2 bg-accent rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-2">
            {Math.round(progress)}%
          </div>
        </div>
      </div>
    </div>
  );
}
