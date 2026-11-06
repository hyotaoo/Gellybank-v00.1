import type { Transaction } from '@/api/transactions';
import DepositIcon from '@/components/icons/DepositIcon';
import TransferIcon from '@/components/icons/TransferIcon';
import WithdrawIcon from '@/components/icons/WithdrawIcon';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const typeCopy: Record<Transaction['type'], { label: string; icon: typeof DepositIcon }> = {
  deposit: { label: 'Deposit', icon: DepositIcon },
  withdraw: { label: 'Withdrawal', icon: WithdrawIcon },
  transfer: { label: 'Transfer', icon: TransferIcon },
};

export const statusCopy: Record<
  Transaction['status'],
  { label: string; bg: string; text: string; dot: string }
> = {
  pending: { label: 'Pending', bg: '#FFF7DF', text: '#8B6C27', dot: '#8B6C27' },
  completed: { label: 'Completed', bg: '#EDF6EE', text: '#43814C', dot: '#43814C' },
  failed: { label: 'Failed', bg: '#FDE8E8', text: '#B3261E', dot: '#B3261E' },
  void: { label: 'Void', bg: '#F2ECE7', text: '#6E6168', dot: '#6E6168' },
};

export const dateLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

export const timeLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const describe = (transaction: Transaction, accountLabel: string): string => {
  if (transaction.type === 'transfer') {
    const recipient = transaction.counterparty ? `To ${transaction.counterparty}` : 'Transfer';
    return transaction.note ? `${recipient} · ${transaction.note}` : recipient;
  }
  if (transaction.type === 'deposit') {
    return `Cash deposit · ${accountLabel}`;
  }
  return transaction.note ?? 'Cardless withdrawal';
};

export const drawerDescription = (transaction: Transaction): string => {
  if (transaction.note) return transaction.note;
  if (transaction.type === 'deposit') return 'Cash deposit';
  if (transaction.type === 'withdraw') return 'Cardless withdrawal';
  return 'Transfer';
};
