import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/utils/format';

const typeLabel: Record<Transaction['type'], string> = {
  deposit: 'Deposit',
  withdraw: 'Withdrawal',
  transfer: 'Transfer',
};

const ascii = (value: string): string =>
  value
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u00B7]/g, '-')
    .replace(/₱/g, 'PHP ')
    .replace(/[^\x20-\x7E]/g, '');

const escapePdf = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildPdf = (lines: string[]): string => {
  const content = lines
    .map((line, index) => {
      const size = index === 0 ? 18 : index === 1 ? 12 : 10;
      const y = 800 - index * 22;
      return `BT /F1 ${size} Tf 50 ${y} Td (${escapePdf(ascii(line))}) Tj ET`;
    })
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
};

export const downloadReceipt = (transaction: Transaction, account?: Account | null): void => {
  const rows = [
    `Reference:     ${transaction.reference}`,
    `Type:          ${typeLabel[transaction.type]}`,
    `Amount:        ${formatCurrency(transaction.amount, transaction.currency)}`,
    `Status:        ${transaction.status.toUpperCase()}`,
    `Date:          ${formatDateTime(transaction.createdAt)}`,
    `Account:       ${account ? formatAccountNumber(account.accountNumber) : transaction.accountId}`,
  ];

  if (transaction.counterparty) rows.push(`Counterparty:  ${transaction.counterparty}`);
  if (transaction.note) rows.push(`Note:          ${transaction.note}`);

  const pdf = buildPdf([
    'GellyBank',
    'Transaction receipt',
    '',
    ...rows,
    '',
    'Thank you for banking with GellyBank.',
  ]);

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `receipt-${transaction.reference}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};