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
