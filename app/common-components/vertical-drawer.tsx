import React, { useEffect, type ReactNode } from "react";
import ReactDOM from "react-dom";

interface VerticalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  direction?: "top" | "bottom";
}

const VerticalDrawer: React.FC<VerticalDrawerProps> = ({
  isOpen,
  onClose,
  children,
  direction = "bottom",
}) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

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
        className={`fixed left-0 right-0 max-w-lg mx-auto bg-white dark:bg-gray-950 border-purple-800 shadow-xl z-50 transition-transform duration-300 ease-in-out ${
          direction === "top"
            ? `top-0 border-b-2 border-x-2 rounded-b-2xl ${isOpen ? "translate-y-0" : "-translate-y-full"}`
            : `bottom-0 border-t-2 border-x-2 rounded-t-2xl ${isOpen ? "translate-y-0" : "translate-y-full"}`
        }`}
        role="dialog"
        aria-modal={isOpen}
      >
        <div className="flex justify-end p-3">
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer"
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

export default VerticalDrawer;
