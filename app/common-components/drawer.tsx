import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom";

export type DrawerDirection = "top" | "bottom" | "left" | "right";

/** Tracks how deeply the current Drawer is nested inside other Drawers so
 * inner drawers can stack above their parents regardless of portal DOM order. */
const DrawerDepthContext = createContext(0);

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
  /** Absolute-positioning classes for the drag handle strip on the panel's exit edge. */
  handleStrip: string;
  /** Size classes for the pill inside the handle strip. */
  pill: string;
  /** Content padding on the exit edge so children don't overlap the handle. */
  contentPadding: string;
};

const DIRECTIONS: Record<DrawerDirection, DirectionConfig> = {
  top: {
    axis: "y",
    sign: -1,
    anchor: "top-0",
    crossAxis: "left-0 right-0",
    border: "border-b-2 border-x-2",
    rounded: "rounded-b-2xl",
    handleStrip: "bottom-0 left-0 right-0 h-8",
    pill: "w-10 h-1.5",
    contentPadding: "px-4 pt-12 pb-10",
  },
  bottom: {
    axis: "y",
    sign: 1,
    anchor: "bottom-0",
    crossAxis: "left-0 right-0",
    border: "border-t-2 border-x-2",
    rounded: "rounded-t-2xl",
    handleStrip: "top-0 left-0 right-0 h-8",
    pill: "w-10 h-1.5",
    contentPadding: "px-4 pt-12 pb-8",
  },
  left: {
    axis: "x",
    sign: -1,
    anchor: "left-0",
    crossAxis: "top-0",
    border: "border-r-2 border-y-2",
    rounded: "rounded-r-2xl",
    handleStrip: "right-0 top-0 bottom-0 w-8",
    pill: "w-1.5 h-10",
    contentPadding: "pl-4 pr-10 pt-12 pb-8",
  },
  right: {
    axis: "x",
    sign: 1,
    anchor: "right-0",
    crossAxis: "top-0",
    border: "border-l-2 border-y-2",
    rounded: "rounded-l-2xl",
    handleStrip: "left-0 top-0 bottom-0 w-8",
    pill: "w-1.5 h-10",
    contentPadding: "pl-10 pr-4 pt-12 pb-8",
  },
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

  const parentDepth = useContext(DrawerDepthContext);
  const depth = parentDepth + 1;
  const backdropZ = 40 + (depth - 1) * 20;
  const panelZ = backdropZ + 10;

  const panelStyle: CSSProperties = {
    transform: activeTransform,
    transition: isDragging ? "none" : "transform 0.3s ease-in-out",
    zIndex: panelZ,
  };

  return ReactDOM.createPortal(
    <DrawerDepthContext.Provider value={depth}>
      <div
        className={`fixed inset-0 bg-gray-900/90 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: backdropZ }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`fixed ${config.anchor} ${config.crossAxis} ${perpendicularClasses} ${resolvedSize} bg-white dark:bg-gray-950 border-purple-800 shadow-xl ${config.border} ${config.rounded}`}
        style={panelStyle}
        role="dialog"
        aria-modal={isOpen}
      >
        {swipeToDismiss && (
          <div
            className={`absolute ${config.handleStrip} z-20 flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-hidden="true"
          >
            <div
              className={`rounded-full bg-purple-700/60 ${config.pill}`}
            />
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-30 cursor-pointer"
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

        <div className={config.contentPadding}>{children}</div>
      </div>
    </DrawerDepthContext.Provider>,
    document.body,
  );
};

export default Drawer;
