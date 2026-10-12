import { useEffect, useRef, useState } from 'react';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import { ApiError, requestNewCard } from '@/api/cards';

type Status = 'idle' | 'loading' | 'success' | 'error';

const RequestCardButton = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>();
  const controllerRef = useRef<AbortController>();

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleRequest = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('loading');
    setMessage(undefined);

    try {
      const card = await requestNewCard({ cardType: 'debit' }, controller.signal);
      setStatus('success');
      setMessage(`New ${card.type} card ending in ${card.last4} requested.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setMessage(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    }
  };

  const isLoading = status === 'loading';

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span
          role="status"
          className={`max-w-[280px] text-right text-[13px] leading-[1.21] ${
            status === 'error' ? 'text-red-600' : 'text-emerald-600'
          }`}
        >
          {message}
        </span>
      )}
      <button
        type="button"
        onClick={handleRequest}
        disabled={isLoading}
        className="flex h-11 flex-none items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <CreditCardIcon className="h-5 w-5" />
        {isLoading ? 'Requesting…' : 'Request new card'}
      </button>
    </div>
  );
};

export default RequestCardButton;
