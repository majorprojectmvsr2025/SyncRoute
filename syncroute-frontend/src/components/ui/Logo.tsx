interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-6 w-6', text: 'text-lg', square: 3, stroke: 1.5 },
    md: { icon: 'h-8 w-8', text: 'text-xl', square: 4, stroke: 2 },
    lg: { icon: 'h-12 w-12', text: 'text-3xl', square: 5, stroke: 2.5 }
  };

  const config = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Simple route connection: two squares connected by curved line */}
      <div className={`${config.icon} relative`}>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Curved connecting line */}
          <path
            d="M 8 24 Q 16 16, 24 8"
            stroke="currentColor"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            className="text-foreground dark:text-white"
            fill="none"
          />
          
          {/* Start square (bottom left) */}
          <rect 
            x={8 - config.square} 
            y={24 - config.square} 
            width={config.square * 2} 
            height={config.square * 2} 
            fill="currentColor" 
            className="text-foreground dark:text-white"
            rx="1"
          />
          
          {/* End square (top right) */}
          <rect 
            x={24 - config.square} 
            y={8 - config.square} 
            width={config.square * 2} 
            height={config.square * 2} 
            fill="currentColor" 
            className="text-foreground dark:text-white"
            rx="1"
          />
        </svg>
      </div>
      
      {showText && (
        <span className={`font-display font-bold tracking-tight ${config.text}`}>
          <span className="text-foreground">SyncRoute</span>
        </span>
      )}
    </div>
  );
}
