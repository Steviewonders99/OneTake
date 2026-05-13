"use client";

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedNumber({ value, format, duration = 400, className, style }: AnimatedNumberProps) {
  const [display, setDisplay] = useState('0');
  const prevRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const startTime = performance.now();

    cancelAnimationFrame(frameRef.current);

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = start + (end - start) * eased;
      setDisplay(format ? format(current) : Math.round(current).toLocaleString());
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
    prevRef.current = value;

    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration, format]);

  return <span className={className} style={style}>{display}</span>;
}
