import { useEffect, useState } from 'react';

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
            setTimeout(onComplete, 500);
          }
          return 100;
        }
        return prev + (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Long Fazers Background */}
      <div className="longfazers">
        <span className="longfazer-1" />
        <span className="longfazer-2" />
        <span className="longfazer-3" />
        <span className="longfazer-4" />
      </div>

      {/* Loader Component - Car Animation */}
      <div className="relative w-full max-w-2xl h-[200px] sm:h-[300px] md:h-[400px] flex items-center justify-center px-4">
        <div className="car-loader">
          <span className="car-lines">
            <span />
            <span />
            <span />
            <span />
          </span>
          <div className="car-body">
            <div className="car-top" />
            <div className="car-bottom" />
            <div className="car-wheel car-wheel-front" />
            <div className="car-wheel car-wheel-back" />
          </div>
        </div>
      </div>

      {/* Content Overlay */}
      <div className="z-20 text-center mt-8 space-y-4">
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground animate-pulse">
          {message}
        </h1>
        <p className="text-muted-foreground font-light tracking-widest uppercase text-xs">
          {subMessage}
        </p>

        {/* Progress Bar */}
        <div className="w-64 h-1 bg-accent rounded-full mx-auto mt-12 overflow-hidden relative">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {Math.round(progress)}%
        </div>
      </div>

      <style>{`
        /* Car Loader - Responsive */
        .car-loader {
          position: relative;
          width: 100%;
          max-width: 200px;
          height: 80px;
          animation: car-bounce 0.5s ease-in-out infinite;
          z-index: 10;
        }

        @media (min-width: 640px) {
          .car-loader {
            max-width: 250px;
            height: 100px;
          }
        }

        @media (min-width: 768px) {
          .car-loader {
            max-width: 300px;
            height: 120px;
          }
        }

        .car-body {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .car-top {
          position: absolute;
          width: 50%;
          height: 40%;
          background: hsl(var(--primary));
          border-radius: 20px 20px 5px 5px;
          top: 10%;
          left: 25%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .car-top:before {
          content: "";
          position: absolute;
          width: 35%;
          height: 60%;
          background: hsl(var(--primary-foreground) / 0.3);
          border-radius: 8px;
          top: 20%;
          left: 15%;
        }

        .car-top:after {
          content: "";
          position: absolute;
          width: 35%;
          height: 60%;
          background: hsl(var(--primary-foreground) / 0.3);
          border-radius: 8px;
          top: 20%;
          right: 15%;
        }

        .car-bottom {
          position: absolute;
          width: 90%;
          height: 35%;
          background: hsl(var(--primary));
          border-radius: 15px;
          bottom: 20%;
          left: 5%;
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }

        .car-bottom:before {
          content: "";
          position: absolute;
          width: 20%;
          height: 50%;
          background: hsl(var(--warning));
          border-radius: 4px;
          top: 25%;
          left: 5%;
        }

        .car-bottom:after {
          content: "";
          position: absolute;
          width: 20%;
          height: 50%;
          background: hsl(var(--destructive));
          border-radius: 4px;
          top: 25%;
          right: 5%;
        }

        .car-wheel {
          position: absolute;
          width: 18%;
          height: 18%;
          background: hsl(var(--foreground));
          border-radius: 50%;
          bottom: 5%;
          border: 3px solid hsl(var(--muted-foreground));
          animation: wheel-spin 0.6s linear infinite;
        }

        .car-wheel-front {
          right: 10%;
        }

        .car-wheel-back {
          left: 10%;
        }

        .car-wheel:before {
          content: "";
          position: absolute;
          width: 40%;
          height: 40%;
          background: hsl(var(--muted));
          border-radius: 50%;
          top: 30%;
          left: 30%;
        }

        .car-lines > span:nth-child(1),
        .car-lines > span:nth-child(2),
        .car-lines > span:nth-child(3),
        .car-lines > span:nth-child(4) {
          width: 20px;
          height: 2px;
          background: hsl(var(--foreground) / 0.3);
          position: absolute;
          animation: speed-line1 0.3s linear infinite;
        }

        @media (min-width: 640px) {
          .car-lines > span {
            width: 30px;
          }
        }

        .car-lines > span:nth-child(2) {
          top: 20%;
          animation: speed-line2 0.4s linear infinite;
        }

        .car-lines > span:nth-child(3) {
          top: 40%;
          animation: speed-line3 0.35s linear infinite;
          animation-delay: -0.5s;
        }

        .car-lines > span:nth-child(4) {
          top: 60%;
          animation: speed-line4 0.5s linear infinite;
          animation-delay: -0.8s;
        }

        @keyframes speed-line1 {
          0% { left: 0; opacity: 0.8; }
          100% { left: -60px; opacity: 0; }
        }

        @keyframes speed-line2 {
          0% { left: 0; opacity: 0.8; }
          100% { left: -80px; opacity: 0; }
        }

        @keyframes speed-line3 {
          0% { left: 0; opacity: 0.8; }
          100% { left: -50px; opacity: 0; }
        }

        @keyframes speed-line4 {
          0% { left: 0; opacity: 0.8; }
          100% { left: -100px; opacity: 0; }
        }

        @keyframes wheel-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes car-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .longfazers {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
        }

        .longfazers span {
          position: absolute;
          height: 2px;
          width: 20%;
          background: hsl(var(--foreground));
          opacity: 0.1;
        }

        .longfazer-1 {
          top: 20%;
          animation: lf 0.6s linear infinite;
          animation-delay: -5s;
        }

        .longfazer-2 {
          top: 40%;
          animation: lf2 0.8s linear infinite;
          animation-delay: -1s;
        }

        .longfazer-3 {
          top: 60%;
          animation: lf3 0.6s linear infinite;
        }

        .longfazer-4 {
          top: 80%;
          animation: lf4 0.5s linear infinite;
          animation-delay: -3s;
        }

        @keyframes lf {
          0% { left: 200%; }
          100% { left: -200%; opacity: 0; }
        }

        @keyframes lf2 {
          0% { left: 200%; }
          100% { left: -200%; opacity: 0; }
        }

        @keyframes lf3 {
          0% { left: 200%; }
          100% { left: -100%; opacity: 0; }
        }

        @keyframes lf4 {
          0% { left: 200%; }
          100% { left: -100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
