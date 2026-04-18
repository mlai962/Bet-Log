import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom";

export type DrawerDirection = "top" | "bottom" | "left" | "right";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  direction?: DrawerDirection;
  /**
   * Perpendicular-axis size class.
   * - top/bottom: max-width of the panel (default "max-w-lg")
   * - left/right: width of the panel (default "w-80")
   */
  size?: string;
  /** Disable drag-to-dismiss on the drawer header. */
  swipeToDismiss?: boolean;
}

type DirectionConfig = {
  axis: "x" | "y";
  /** +1 if the drawer closes by moving in the positive direction (bottom/right). */
  sign: 1 | -1;
  anchor: string;
  crossAxis: string;
  border: string;
  rounded: string;
  /** Edge the grab handle sits against. */
  handleEdge: "top" | "bottom" | "left" | "right";
};

const DIRECTIONS: Record<DrawerDirection, DirectionConfig> = {
  top: {
    axis: "y",
    sign: -1,
    anchor: "top-0",
    crossAxis: "left-0 right-0",
    border: "border-b-2 border-x-2",
    rounded: "rounded-b-2xl",
    handleEdge: "bottom",
  },
  bottom: {
    axis: "y",
    sign: 1,
    anchor: "bottom-0",
    crossAxis: "left-0 right-0",
    border: "border-t-2 border-x-2",
    rounded: "rounded-t-2xl",
    handleEdge: "top",
  },
  left: {
    axis: "x",
    sign: -1,
    anchor: "left-0",
    crossAxis: "top-0",
    border: "border-r-2 border-y-2",
    rounded: "rounded-r-2xl",
    handleEdge: "right",
  },
  right: {
    axis: "x",
    sign: 1,
    anchor: "right-0",
    crossAxis: "top-0",
    border: "border-l-2 border-y-2",
    rounded: "rounded-l-2xl",
    handleEdge: "left",
  },
};

const HANDLE_EDGE_CLASS: Record<DirectionConfig["handleEdge"], string> = {
  top: "top-2 left-1/2 -translate-x-1/2 w-10 h-1.5",
  bottom: "bottom-2 left-1/2 -translate-x-1/2 w-10 h-1.5",
  left: "left-2 top-1/2 -translate-y-1/2 h-10 w-1.5",
  right: "right-2 top-1/2 -translate-y-1/2 h-10 w-1.5",
};

const DISMISS_THRESHOLD_RATIO = 0.3;
const OPEN_TRANSFORM = "translate(0, 0)";

const closedTransform = (direction: DrawerDirection) => {
  switch (direction) {
    case "top":
      return "translate(0, -100%)";
    case "bottom":
      return "translate(0, 100%)";
    case "left":
      return "translate(-100%, 0)";
    case "right":
      return "translate(100%, 0)";
  }
};

const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  direction = "bottom",
  size,
  swipeToDismiss = true,
}) => {
  const config = DIRECTIONS[direction];
  const isVertical = config.axis === "y";
  const resolvedSize = size ?? (isVertical ? "max-w-lg" : "w-80");
  const perpendicularClasses = isVertical ? "mx-auto" : "h-full";

  const panelRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Reset any in-progress drag when the open state flips.
  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
    startRef.current = null;
  }, [isOpen]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeToDismiss) return;
    // Don't hijack taps on interactive elements inside the header.
    if ((e.target as HTMLElement).closest("button, a, input, [data-no-swipe]"))
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !startRef.current) return;
    const delta =
      config.axis === "x"
        ? e.clientX - startRef.current.x
        : e.clientY - startRef.current.y;

    // Only allow motion in the closing direction; clamp the other side to 0.
    const clamped =
      config.sign === 1 ? Math.max(0, delta) : Math.min(0, delta);
    setDragOffset(clamped);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    startRef.current = null;

    const panel = panelRef.current;
    const panelSize =
      config.axis === "x"
        ? panel?.offsetWidth ?? 0
        : panel?.offsetHeight ?? 0;
    const threshold = panelSize * DISMISS_THRESHOLD_RATIO;

    if (Math.abs(dragOffset) > threshold) {
      onClose();
    }
    setDragOffset(0);
  };

  const resting = isOpen ? OPEN_TRANSFORM : closedTransform(direction);
  const activeTransform =
    isDragging && dragOffset !== 0
      ? config.axis === "x"
        ? `translate(${dragOffset}px, 0)`
        : `translate(0, ${dragOffset}px)`
      : resting;

  const panelStyle: CSSProperties = {
    transform: activeTransform,
    transition: isDragging ? "none" : "transform 0.3s ease-in-out",
  };

  return ReactDOM.createPortal(
    <>
      <div
        className={`fixed inset-0 bg-gray-900/90 backdrop-blur-xs z-40 transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`fixed ${config.anchor} ${config.crossAxis} ${perpendicularClasses} ${resolvedSize} bg-white dark:bg-gray-950 border-purple-800 shadow-xl z-50 ${config.border} ${config.rounded}`}
        style={panelStyle}
        role="dialog"
        aria-modal={isOpen}
      >
        <div
          className="relative flex justify-end p-3 touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {swipeToDismiss && (
            <div
              aria-hidden="true"
              className={`absolute rounded-full bg-purple-700/60 ${HANDLE_EDGE_CLASS[config.handleEdge]}`}
            />
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer relative z-10"
          >
            <svg
              className="w-6 h-6 dark:text-white"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18 17.94 6M18 18 6.06 6"
              />
            </svg>
          </button>
        </div>
        <div className="px-4 pb-8">{children}</div>
      </div>
    </>,
    document.body,
  );
};

export default Drawer;
