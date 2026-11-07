import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { listCards } from '@/api/cards';
import type { BankCard } from '@/api/cards';
import CopyButton from '@/components/common/CopyButton';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import DepositIcon from '@/components/icons/DepositIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';
import EyeIcon from '@/components/icons/EyeIcon';
import FlipIcon from '@/components/icons/FlipIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import QuickActionCard from '@/components/dashboard/QuickActionCard';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency } from '@/utils/format';

interface QuickAction {
  label: string;
  to: string;
  icon: ReactNode;
}

const quickActions: QuickAction[] = [
  { label: 'Transfer', to: '/dashboard/transfer', icon: <TransferIcon className="h-6 w-6" /> },
  { label: 'Deposit', to: '/dashboard/deposit', icon: <DepositIcon className="h-6 w-6" /> },
  { label: 'Withdraw', to: '/dashboard/withdraw', icon: <WithdrawIcon className="h-6 w-6" /> },
];

const controlButtonClass =
  'flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/[0.16] transition-colors hover:bg-white/[0.24] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

const faceClass =
  'col-start-1 row-start-1 flex flex-col rounded-[36px] bg-balance-gradient px-10 py-[26.5px] text-white shadow-balance [backface-visibility:hidden] [text-shadow:0_1px_2px_rgba(51,27,41,0.35)]';

const maskCardNumber = (value: string): string => {
  const digits = value.replace(/\s+/g, '');
  const tail = digits.slice(-4);
  return `${'•'.repeat(12)} ${tail}`.replace(/(.{4})/g, '$1 ').trim();
};

const formatCardNumber = (value: string): string => {
  const digits = value.replace(/\s+/g, '');
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const formatExpiry = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
};

// Figma 3:1386 — 688 wide, r36, p40, angular pink gradient, 0/20/40 shadow
const BalanceCard = () => {
  const [flipped, setFlipped] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [card, setCard] = useState<BankCard | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const { selectedAccount } = useAccounts();
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (!selectedAccount) {
      setCard(null);
      setCardError(null);
      return () => controller.abort();
    }

    listCards(selectedAccount.id, controller.signal)
      .then((cards) => {
        if (controller.signal.aborted) return;
        const match = cards.find((item) => item.accountId === selectedAccount.id);
        setCard(match ?? null);
        setCardError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCardError(err instanceof ApiError ? err.message : 'Unable to load card details.');
      });

    return () => controller.abort();
  }, [selectedAccount]);

  const balanceLabel = selectedAccount
    ? formatCurrency(selectedAccount.balance, selectedAccount.currency)
    : '₱0.00';

  const secondaryLine = (() => {
    if (!selectedAccount) return 'No account selected';
    if (selectedAccount.type === 'savings') {
      return `Interest Earned: ${(selectedAccount.interestEarned ?? 0).toFixed(2)}`;
    }
    if (selectedAccount.overdraftLimit) {
      return `Overdraft available: ${formatCurrency(selectedAccount.overdraftLimit, selectedAccount.currency)}`;
    }
    return 'Instant access checking account';
  })();

  const cardNumberLabel = card?.cardNumber
    ? detailsVisible
      ? formatCardNumber(card.cardNumber)
      : maskCardNumber(card.cardNumber)
    : '•••• •••• •••• ••••';
  const cvvLabel = card?.cvv ? (detailsVisible ? card.cvv : '•••') : '•••';
  const cardHolder = card?.holder || (detailsVisible ? '—' : '••••••••••••');

  return (
    <section className="flex h-[295px] flex-none [perspective:1600px]">
      <div
        className={`grid h-full w-full transition-transform duration-700 ease-out [transform-style:preserve-3d] motion-reduce:transition-none ${
          flipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
        }`}
      >
        {/* Front — balance */}
        <div
          aria-hidden={flipped}
          className={`${faceClass} ${flipped ? 'pointer-events-none' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center">
                <WalletIcon className="h-[35px] w-[35px]" />
              </span>
              <span className="text-[36px] font-bold leading-[43px]">Available balance</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFlipped(true)}
                aria-label="Show card details"
                title="Show card details"
                className={controlButtonClass}
              >
                <CreditCardIcon className="h-[22px] w-[22px]" />
              </button>
              <button
                type="button"
                onClick={() => setBalanceHidden((hidden) => !hidden)}
                aria-label={balanceHidden ? 'Show balance' : 'Hide balance'}
                title={balanceHidden ? 'Show balance' : 'Hide balance'}
                className={controlButtonClass}
              >
                <EyeOffIcon className="h-[22px] w-[22px]" />
              </button>
            </div>
          </div>

          <p className="text-[64px] font-normal leading-[77px] tracking-[-1.5px]">
            {balanceHidden ? '₱••••••' : balanceLabel}
          </p>

          <div className="flex h-[37px] items-center justify-between">
            <span className="min-w-0 truncate pr-3 text-[16px] font-normal leading-[19px]">{secondaryLine}</span>
            <span className="flex h-[23px] flex-none items-center gap-1.5 rounded-full bg-white/[0.16] px-3">
              <CircleCheckIcon className="h-4 w-4" />
              <span className="text-[14px] font-semibold leading-[17px] capitalize">
                {selectedAccount?.status ?? 'Active'}
              </span>
            </span>
          </div>

          <div className="mt-auto flex gap-3">
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.label}
                icon={action.icon}
                label={action.label}
                to={action.to}
              />
            ))}
          </div>
        </div>

        {/* Back — card details */}
        <div
          aria-hidden={!flipped}
          className={`${faceClass} [transform:rotateY(180deg)] ${flipped ? '' : 'pointer-events-none'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center">
                <CreditCardIcon className="h-[35px] w-[35px]" />
              </span>
              <span className="text-[36px] font-bold leading-[43px]">Card details</span>
              <span className="flex h-[23px] flex-none items-center gap-1.5 rounded-full bg-white/[0.16] px-3 text-[14px] font-semibold leading-[17px]">
                {card ? `${card.type} · ${card.status}` : 'No card'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDetailsVisible((visible) => !visible)}
                aria-label={detailsVisible ? 'Hide card details' : 'Show card details'}
                title={detailsVisible ? 'Hide card details' : 'Show card details'}
                className={controlButtonClass}
              >
                {detailsVisible ? (
                  <EyeIcon className="h-[22px] w-[22px]" />
                ) : (
                  <EyeOffIcon className="h-[22px] w-[22px]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                aria-label="Show balance"
                title="Show balance"
                className={controlButtonClass}
              >
                <FlipIcon className="h-[22px] w-[22px]" />
              </button>
            </div>
          </div>

          {cardError ? (
            <p role="alert" className="relative mt-10 text-[15px] leading-[1.21] text-white/90">
              {cardError}
            </p>
          ) : (
            <>
              <div className="mt-6">
                <span className="block h-8 w-11 rounded-[7px] bg-white/[0.3]" />
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[36px] font-semibold leading-[43px] tracking-[0.14em]">
                    {cardNumberLabel}
                  </span>
                  {detailsVisible && card?.cardNumber && (
                    <CopyButton
                      value={card.cardNumber.replace(/\s/g, '')}
                      label="Copy card number"
                      tone="light"
                      className="bg-white/[0.16] p-2 hover:bg-white/[0.24]"
                    />
                  )}
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between pt-6">
                <div className="flex gap-14">
                  <div>
                    <p className="text-[14px] uppercase leading-[17px] tracking-[0.08em] text-white/85">
                      Card holder
                    </p>
                    <p className="mt-1 text-[20px] font-semibold leading-[24px]">{cardHolder}</p>
                  </div>
                  <div>
                    <p className="text-[14px] uppercase leading-[17px] tracking-[0.08em] text-white/85">
                      Validity
                    </p>
                    <p className="mt-1 text-[20px] font-semibold leading-[24px]">
                      {card ? formatExpiry(card.expiresOn) : '••/••'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[14px] uppercase leading-[17px] tracking-[0.08em] text-white/85">
                      CVV
                    </p>
                    <p className="mt-1 text-[20px] font-semibold leading-[24px]">{cvvLabel}</p>
                  </div>
                </div>
                <span className="text-[16px] font-semibold leading-[19px] text-white/90">GellyBank</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default BalanceCard;
