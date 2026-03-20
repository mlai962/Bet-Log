import { useEffect, useRef, useState } from "react";

type FitTextProps = {
  text: string;
  maxSize?: number;
  minSize?: number;
  cap?: number;
  className?: string;
  onFitSize?: (size: number) => void;
};

/**
 * Renders text that automatically shrinks to fit its container width.
 * Uses a binary search on font-size to avoid layout thrashing.
 * Reports the natural (uncapped) settled size via onFitSize so siblings can synchronise.
 * The cap prop applies an external upper bound on the displayed size without affecting measurement.
 */
export default function FitText({
  text,
  maxSize = 64,
  minSize = 12,
  cap,
  className,
  onFitSize,
}: FitTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState(maxSize);

  // Keep refs current so fit() always reads the latest values without being a dep
  const capRef = useRef(cap);
  capRef.current = cap;
  const onFitSizeRef = useRef(onFitSize);
  onFitSizeRef.current = onFitSize;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      el.style.fontSize = `${maxSize}px`;

      let natural: number;
      if (el.scrollWidth <= el.offsetWidth) {
        natural = maxSize;
      } else {
        let lo = minSize;
        let hi = maxSize;
        while (lo < hi - 1) {
          const mid = Math.floor((lo + hi) / 2);
          el.style.fontSize = `${mid}px`;
          if (el.scrollWidth <= el.offsetWidth) lo = mid;
          else hi = mid;
        }
        natural = lo;
      }

      // Always leave the element at the correct display size so ResizeObserver stabilises
      const display = capRef.current !== undefined ? Math.min(natural, capRef.current) : natural;
      el.style.fontSize = `${display}px`;

      setNaturalSize(natural);
      onFitSizeRef.current?.(natural);
    };

    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, [text, maxSize, minSize]);

  const displaySize = cap !== undefined ? Math.min(naturalSize, cap) : naturalSize;

  return (
    <div ref={ref} className={className} style={{ fontSize: displaySize }}>
      {text}
    </div>
  );
}
