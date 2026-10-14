import { useState } from 'react';
import type { ReactNode } from 'react';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';
import CreditCardIcon from '@/components/icons/CreditCardIcon';
import DepositIcon from '@/components/icons/DepositIcon';
import EyeOffIcon from '@/components/icons/EyeOffIcon';
import FlipIcon from '@/components/icons/FlipIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WalletIcon from '@/components/icons/WalletIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';
import CopyButton from '@/components/common/CopyButton';
import AccountTypeBadge from '@/components/dashboard/AccountTypeBadge';
import QuickActionCard from '@/components/dashboard/QuickActionCard';
import { useAccounts } from '@/context/AccountContext';
import { formatCurrency } from '@/utils/format';

interface QuickAction {
  label: string;
  to: string;
  icon: ReactNode;
}

const quickActions: QuickAction[] = [
  { label: 'Deposit', to: '/dashboard/deposit', icon: <DepositIcon className="h-6 w-6" /> },
  { label: 'Withdraw', to: '/dashboard/withdraw', icon: <WithdrawIcon className="h-6 w-6" /> },
  { label: 'Transfer', to: '/dashboard/transfer', icon: <TransferIcon className="h-6 w-6" /> },
];

const CARD = {
  type: 'Debit',
  number: '5476 8102 4450 3388',
  holder: 'JHAMEL ROSE SUMAGUE',
  validity: '08/29',
  cvv: '337',
};

const controlButtonClass =
  'flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.16] text-white transition-colors hover:bg-white/[0.24] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

const BalanceCard = () => {
  const [flipped, setFlipped] = useState(false);
  const { selectedAccount } = useAccounts();

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

  return (
    <section className="flex h-[320px] flex-none [perspective:1600px]">
      <div
        className={`relative flex flex-1 transition-transform duration-700 ease-out [transform-style:preserve-3d] motion-reduce:transition-none ${
          flipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
        }`}
      >
        <div
          aria-hidden={flipped}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-[36px] bg-brand-gradient p-10 [backface-visibility:hidden] ${
            flipped ? 'pointer-events-none' : ''
          }`}
        >
          <span className="pointer-events-none absolute -right-[104px] -top-[106px] h-[292px] w-[292px] rounded-full bg-white/[0.12]" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3 text-white">
              <WalletIcon className="h-5 w-5" />
              <span className="text-[18px] font-medium leading-[1.21]">Available balance</span>
              {selectedAccount && <AccountTypeBadge type={selectedAccount.type} />}
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
                aria-label="Hide balance"
                title="Hide balance"
                className={controlButtonClass}
              >
                <EyeOffIcon className="h-[22px] w-[22px]" />
              </button>
            </div>
          </div>

          <p className="relative text-[64px] font-bold leading-[1.21] tracking-[-0.028em] text-white">
            {balanceLabel}
          </p>

          <div className="relative flex items-center justify-between text-white">
            <span className="text-[15px] leading-[1.21]">{secondaryLine}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/[0.16] px-3 py-1.5">
              <CircleCheckIcon className="h-4 w-4" />
              <span className="text-[14px] font-semibold leading-[1.21] capitalize">
                {selectedAccount?.status ?? 'Active'}
              </span>
            </span>
          </div>

          <div className="relative mt-auto flex gap-3">
            {quickActions.map((action) => (
              <QuickActionCard key={action.label} icon={action.icon} label={action.label} to={action.to} />
            ))}
          </div>
        </div>

        <div
          aria-hidden={!flipped}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-[36px] bg-brand-gradient p-10 text-white [backface-visibility:hidden] [transform:rotateY(180deg)] ${
            flipped ? '' : 'pointer-events-none'
          }`}
        >
          <span className="pointer-events-none absolute -bottom-[120px] -left-[90px] h-[292px] w-[292px] rounded-full bg-white/[0.12]" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WalletIcon className="h-5 w-5" />
              <span className="text-[18px] font-medium leading-[1.21]">Card details</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-white/[0.16] px-3 py-1.5 text-[14px] font-semibold leading-[1.21]">
                {CARD.type} · Active
              </span>
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

          <div className="relative mt-7">
            <span className="block h-8 w-11 rounded-[7px] bg-white/[0.3]" />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[34px] font-semibold leading-[1.21] tracking-[0.14em]">
                {CARD.number}
              </span>
              <CopyButton
                value={CARD.number.replace(/\s/g, '')}
                label="Copy card number"
                tone="light"
                className="bg-white/[0.16] p-2 hover:bg-white/[0.24]"
              />
            </div>
          </div>

          <div className="relative mt-auto flex items-end justify-between">
            <div className="flex gap-14">
              <div>
                <p className="text-[12px] uppercase tracking-[0.12em] text-white/70">Card holder</p>
                <p className="mt-1 text-[18px] font-semibold leading-[1.21]">{CARD.holder}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-[0.12em] text-white/70">Validity</p>
                <p className="mt-1 text-[18px] font-semibold leading-[1.21]">{CARD.validity}</p>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-[0.12em] text-white/70">CVV</p>
                <p className="mt-1 text-[18px] font-semibold leading-[1.21]">{CARD.cvv}</p>
              </div>
            </div>
            <span className="text-[15px] font-medium leading-[1.21] text-white/80">
              GellyBank
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BalanceCard;
