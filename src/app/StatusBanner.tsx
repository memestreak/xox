"use client";

interface StatusBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export default function StatusBanner({
  message,
  onDismiss,
}: StatusBannerProps) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 border ${
        message
          ? 'max-h-[60px] border-amber-700 bg-amber-900/80 text-amber-200 rounded-lg mt-2 lg:mt-3'
          : 'max-h-0 border-transparent'
      }`}
      role="alert"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm truncate">
          {message}
        </span>
        <button
          onClick={onDismiss}
          className="ml-2 shrink-0 text-amber-400 hover:text-amber-200 transition-colors"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
