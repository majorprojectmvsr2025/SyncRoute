import { useRef, useState } from "react";
import { motion, useMotionValue, useAnimationFrame, useTransform } from "framer-motion";

interface ShinyTextProps {
  text: string;
  speed?: number;          // seconds per cycle
  className?: string;
  color?: string;          // base text color
  shineColor?: string;     // highlight color
  spread?: number;         // gradient angle
  delay?: number;          // seconds before first shine
}

/**
 * Text with a sweeping shine gradient. Uses framer-motion's
 * useAnimationFrame for smooth, GPU-accelerated animation.
 * Adapted from the ShinyText spec to use the project's motion library.
 */
export function ShinyText({
  text,
  speed = 3,
  className = "",
  color = "currentColor",
  shineColor = "rgba(255,255,255,0.85)",
  spread = 110,
  delay = 0,
}: ShinyTextProps) {
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const lastTime = useRef<number | null>(null);
  const animDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useAnimationFrame(time => {
    if (lastTime.current === null) { lastTime.current = time; return; }
    elapsed.current += time - lastTime.current;
    lastTime.current = time;

    const cycleDuration = animDuration + delayDuration;
    const cycleTime = elapsed.current % cycleDuration;
    if (cycleTime < animDuration) {
      progress.set((cycleTime / animDuration) * 100);
    } else {
      progress.set(100);
    }
  });

  // p=0 → shine starts off right (150%), p=100 → shine exits left (-50%)
  const backgroundPosition = useTransform(progress, p => `${150 - p * 2}% center`);

  return (
    <motion.span
      className={`inline-block ${className}`}
      style={{
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundPosition,
      }}
    >
      {text}
    </motion.span>
  );
}
