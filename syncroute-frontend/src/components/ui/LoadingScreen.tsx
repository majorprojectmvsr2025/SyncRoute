import { useEffect, useState } from "react";

interface LoadingScreenProps {
  minDuration?: number;
}

export function LoadingScreen({ minDuration = 500 }: LoadingScreenProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), minDuration);
    return () => clearTimeout(timer);
  }, [minDuration]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Logo/Brand */}
        <div className="text-2xl font-bold text-neutral-900 tracking-tight">
          SyncRoute
        </div>
        
        {/* Simple spinner */}
        <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    </div>
  );
}

/* Page loading indicator - smaller, inline */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
        <span className="text-sm text-neutral-500">Loading...</span>
      </div>
    </div>
  );
}

/* Button loading spinner */
export function ButtonSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin ${className}`} />
  );
}
