import React, {
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import ReactDOM from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = "hidden";
    } else {
      setShow(false);
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 bg-gray-900/90 flex items-center justify-center z-50 backdrop-blur-xs transition-opacity duration-300 ease-out ${
        show ? "opacity-100" : "opacity-0"
      }`}
      // Don't allow outside click to dismiss
      onClick={() => {
        // No-op (modal stays open)
      }}
    >
      <div
        className={`min-w-sm min-h-64 max-w-max max-h-max bg-gray-900 border-2 border-purple-900 rounded-lg p-8 relative transform transition-all duration-300 ease-out ${
          show ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={stopPropagation}
      >
        <button
          className="absolute top-1 right-1 text-xl text-white cursor-pointer"
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg
            className="w-6 h-6 text-gray-800 dark:text-white"
            aria-hidden="true"
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
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
