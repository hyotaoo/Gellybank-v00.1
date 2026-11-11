import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastVariant = 'success' | 'error';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  error: 8000,
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

const SuccessIcon = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0 text-emerald-600" aria-hidden="true">
    <circle cx="20" cy="20" r="19" fill="currentColor" />
    <path
      d="M11 20.5l6 6L29 14"
      fill="none"
      stroke="#fff"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      className="animate-toast-check"
    />
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0 text-red-600" aria-hidden="true">
    <circle cx="20" cy="20" r="19" fill="currentColor" />
    <path
      d="M14 14l12 12"
      fill="none"
      stroke="#fff"
      strokeWidth="3"
      strokeLinecap="round"
      pathLength={1}
      className="animate-toast-cross"
    />
    <path
      d="M26 14L14 26"
      fill="none"
      stroke="#fff"
      strokeWidth="3"
      strokeLinecap="round"
      pathLength={1}
      className="animate-toast-cross animate-toast-cross-late"
    />
  </svg>
);

const ToastCard = ({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) => (
  <div
    role={item.variant === 'error' ? 'alert' : 'status'}
    aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
    className={`animate-toast-in pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-white p-4 shadow-lg ${
      item.variant === 'error' ? 'border-red-200' : 'border-emerald-200'
    }`}
  >
    {item.variant === 'error' ? <ErrorIcon /> : <SuccessIcon />}
    <div className="flex-1 pt-0.5">
      <p className={`font-semibold ${item.variant === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
        {item.variant === 'error' ? 'Action failed' : 'Success'}
      </p>
      <p className="mt-0.5 text-sm text-ink">{item.message}</p>
    </div>
    <button
      type="button"
      aria-label="Dismiss message"
      onClick={() => onClose(item.id)}
      className="rounded-full p-1 text-muted transition-colors hover:bg-surface-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  </div>
);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, variant, message }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS[variant]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const api: ToastApi = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
