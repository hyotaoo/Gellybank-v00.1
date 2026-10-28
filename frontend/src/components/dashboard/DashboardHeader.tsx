import avatar from '@/assets/avatar.png';
import BellIcon from '@/components/icons/BellIcon';
import CopyButton from '@/components/common/CopyButton';
import RequestCardButton from '@/components/dashboard/RequestCardButton';
import { useAccounts } from '@/context/AccountContext';
import { formatAccountNumber } from '@/utils/format';

const USER_NAME = 'JHAMEL ROSE SUMAGUE';

interface DashboardHeaderProps {
  title?: string;
}

const DashboardHeader = ({ title = 'Dashboard' }: DashboardHeaderProps) => {
  const { selectedAccount } = useAccounts();
  const accountNumber = selectedAccount
    ? formatAccountNumber(selectedAccount.accountNumber)
    : '—';

  return (
    <header className="flex flex-none flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:h-[120px] lg:pl-[14px] lg:pr-[30px] lg:pt-[33px]">
      <h1 className="text-[30px] font-semibold leading-none text-primary sm:text-[36px]">{title}</h1>

      <div className="flex items-center gap-3 sm:gap-6">
        <RequestCardButton />

        <button
          type="button"
          aria-label="Notifications"
          className="flex h-[35px] w-[39px] items-center justify-center text-primary transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
        >
          <BellIcon className="h-[33px] w-[33px]" />
        </button>

        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <img
            src={avatar}
            alt={USER_NAME}
            className="h-[61px] w-[61px] flex-none rounded-full border border-surface-input object-cover"
          />
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate text-[20px] font-semibold leading-[1.21] text-ink">{USER_NAME}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] leading-[1.21] text-muted">
                Account No. {accountNumber}
              </span>
              {selectedAccount && (
                <CopyButton
                  value={selectedAccount.accountNumber}
                  label="Copy account number"
                  className="p-0.5"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
