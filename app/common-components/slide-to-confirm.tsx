import { useRef, useState } from "react";

type SlideToConfirmVariant = "red" | "purple";

type SlideToConfirmProps = {
  label?: string;
  onConfirm: () => void;
  variant?: SlideToConfirmVariant;
};

// Tailwind needs complete class names at build time, so enumerate variants.
const VARIANT_CLASSES: Record<
  SlideToConfirmVariant,
  { border: string; label: string; fill: string; thumb: string }
> = {
  red: {
    border: "border-red-900",
    label: "text-red-400",
    fill: "bg-red-800/50",
    thumb: "bg-red-700",
  },
  purple: {
    border: "border-purple-800",
    label: "text-purple-300",
    fill: "bg-purple-700/50",
    thumb: "bg-purple-600",
  },
};

/**
 * A slide-to-confirm control. The user drags the thumb rightward to confirm.
 * Releases without reaching the threshold snap the thumb back to the start.
 */
export default function SlideToConfirm({
  label = "slide to confirm",
  onConfirm,
  variant = "red",
}: SlideToConfirmProps) {
  const colors = VARIANT_CLASSES[variant];
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const THUMB_SIZE = 56;

  const getMaxX = () => (trackRef.current?.offsetWidth ?? 300) - THUMB_SIZE;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !trackRef.current) return;
    const trackRect = trackRef.current.getBoundingClientRect();
    const maxX = getMaxX();
    const newX = Math.max(
      0,
      Math.min(e.clientX - trackRect.left - THUMB_SIZE / 2, maxX),
    );
    setDragX(newX);
    if (newX >= maxX) {
      setIsDragging(false);
      onConfirm();
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragX(0);
  };

  const progress = getMaxX() > 0 ? dragX / getMaxX() : 0;

  return (
    <div
      ref={trackRef}
      className={`relative w-full h-14 rounded-full overflow-hidden select-none
        bg-gray-800 border ${colors.border}`}
    >
      {/* Label — fades as thumb advances */}
      <div
        className={`absolute inset-0 flex items-center justify-center font-semibold pointer-events-none ${colors.label}`}
        style={{ opacity: Math.max(0, 1 - progress * 2) }}
      >
        {label}
      </div>

      {/* Fill */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${colors.fill}`}
        style={{
          width: `${dragX + THUMB_SIZE}px`,
          transition: isDragging ? "none" : "width 0.3s ease",
        }}
      />

      {/* Thumb */}
      <div
        className={`absolute top-0 h-14 w-14 rounded-full flex items-center justify-center
          cursor-grab active:cursor-grabbing touch-none ${colors.thumb}`}
        style={{
          left: `${dragX}px`,
          transition: isDragging ? "none" : "left 0.3s ease",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </div>
  );
}
