import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom";

type ToastVariant = "error" | "info";

type ToastState = {
  id: number;
  message: string;
  variant: ToastVariant;
  visible: boolean;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ENTER_DURATION_MS = 300;
const VISIBLE_DURATION_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timeouts = useRef<Map<number, ReturnType<typeof setTimeout>[]>>(
    new Map(),
  );

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t)),
    );
    const removeHandle = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeouts.current.delete(id);
    }, ENTER_DURATION_MS);
    timeouts.current.set(id, [
      ...(timeouts.current.get(id) ?? []),
      removeHandle,
    ]);
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "error") => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, variant, visible: false }]);

      const enterHandle = setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, visible: true } : t)),
        );
      }, 16);
      const autoDismissHandle = setTimeout(
        () => dismiss(id),
        VISIBLE_DURATION_MS,
      );
      timeouts.current.set(id, [enterHandle, autoDismissHandle]);
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timeouts.current;
    return () => {
      active.forEach((handles) => handles.forEach(clearTimeout));
      active.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const VARIANT_CLASSES: Record<
  ToastVariant,
  { border: string; text: string; iconPath: string }
> = {
  error: {
    border: "border-red-800",
    text: "text-red-300",
    iconPath:
      "M12 9v4m0 3v.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
  },
  info: {
    border: "border-purple-800",
    text: "text-purple-200",
    iconPath:
      "M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastState[];
  onDismiss: (id: number) => void;
}) {
  if (typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-6 pointer-events-none"
      style={{ zIndex: 1000 }}
    >
      {toasts.map((toast) => {
        const colors = VARIANT_CLASSES[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            onClick={() => onDismiss(toast.id)}
            className={`pointer-events-auto w-full max-w-md flex items-center gap-3 px-4 py-3 rounded-xl border-2 shadow-xl cursor-pointer
              bg-gray-950 ${colors.border} ${colors.text}
              transition-transform duration-300 ease-out
              ${toast.visible ? "translate-y-0" : "translate-y-[calc(100%+2rem)]"}`}
          >
            <svg
              className="w-5 h-5 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={colors.iconPath}
              />
            </svg>
            <div className="flex-1 text-sm font-semibold">{toast.message}</div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
