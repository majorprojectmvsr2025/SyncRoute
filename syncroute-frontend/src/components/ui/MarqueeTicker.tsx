import { useRef } from "react";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";

interface TickerItem {
  text: string;
  icon?: React.ReactNode;
}

interface MarqueeTickerProps {
  items: TickerItem[];
  speed?: number;   // px per second
  className?: string;
  separator?: React.ReactNode;
}

/**
 * A continuous horizontal ticker / marquee.
 * Uses framer-motion's useAnimationFrame for smooth, jank-free scrolling.
 * Duplicates the items so the loop is seamless.
 */
export function MarqueeTicker({
  items,
  speed = 55,
  className = "",
  separator,
}: MarqueeTickerProps) {
  const x = useMotionValue(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useAnimationFrame((_, delta) => {
    const track = trackRef.current;
    if (!track) return;
    const halfW = track.scrollWidth / 2;
    let current = x.get() - (speed * delta) / 1000;
    // Reset when we've scrolled one full copy
    if (current <= -halfW) current += halfW;
    x.set(current);
  });

  const allItems = [...items, ...items]; // duplicate for seamless loop

  const defaultSep = (
    <span className="mx-6 text-muted-foreground/30 select-none text-lg">·</span>
  );

  return (
    <div className={`overflow-hidden ${className}`}>
      <motion.div
        ref={trackRef}
        className="flex items-center whitespace-nowrap will-change-transform"
        style={{ x }}
      >
        {allItems.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 shrink-0">
            {item.icon && (
              <span className="text-muted-foreground/50 shrink-0">{item.icon}</span>
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {item.text}
            </span>
            {separator ?? defaultSep}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
