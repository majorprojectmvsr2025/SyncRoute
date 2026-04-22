import { useRef, useEffect, useState } from "react";

/**
 * Renders children with a hand-drawn SVG underline that animates in
 * when the element scrolls into view. The underline is a slightly
 * wobbly path so it looks natural, not mechanical.
 */
interface UnderlineRevealProps {
  children: React.ReactNode;
  className?: string;
  color?: string;       // stroke color — defaults to currentColor
  thickness?: number;   // stroke width in px
  delay?: number;       // animation delay in ms
}

export function UnderlineReveal({
  children,
  className = "",
  color = "currentColor",
  thickness = 3,
  delay = 0,
}: UnderlineRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <span ref={ref} className={`relative inline-block ${className}`}>
      {children}
      {/* SVG underline — absolutely positioned below the text */}
      <span
        aria-hidden
        className="absolute left-0 right-0 pointer-events-none"
        style={{ bottom: "-4px", height: "10px" }}
      >
        <svg
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          {/* Hand-drawn wobbly path */}
          <path
            d="M 0 6 C 15 2, 30 9, 50 5 C 70 1, 85 8, 100 5"
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 120,
              strokeDashoffset: visible ? 0 : 120,
              transition: visible
                ? `stroke-dashoffset 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`
                : "none",
              opacity: visible ? 1 : 0,
            }}
          />
        </svg>
      </span>
    </span>
  );
}
