export const formatCurrency = (amount: number, currency = 'PHP'): string =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export const formatAccountNumber = (value: string): string =>
  value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

export const maskAccountNumber = (value: string): string => {
  const digits = value.replace(/\s+/g, '');
  return digits.length <= 4 ? digits : `•••• ${digits.slice(-4)}`;
};

export const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date);
};

export const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const formatRelativeTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diff = date.getTime() - Date.now();
  const distance = Math.abs(diff);
  if (distance < 60_000) return 'Just now';

  const units: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
    { unit: 'minute', ms: 60_000 },
    { unit: 'hour', ms: 3_600_000 },
    { unit: 'day', ms: 86_400_000 },
    { unit: 'week', ms: 604_800_000 },
    { unit: 'month', ms: 2_592_000_000 },
    { unit: 'year', ms: 31_536_000_000 },
  ];

  let selected = units[0];
  for (const unit of units) {
    if (distance >= unit.ms) selected = unit;
  }

  const amount = Math.round(distance / selected.ms) * Math.sign(diff);
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(amount, selected.unit);
};
