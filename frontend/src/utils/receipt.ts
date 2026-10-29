import type { Account } from '@/api/accounts';
import type { Transaction } from '@/api/transactions';
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/utils/format';

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );

export const receiptTypeLabel = (type: Transaction['type']): string => {
  switch (type) {
    case 'deposit':
      return 'Deposit';
    case 'withdraw':
      return 'Withdrawal';
    case 'transfer':
      return 'Transfer';
    default:
      return type;
  }
};

export const receiptAmountPrefix = (type: Transaction['type']): string =>
  type === 'deposit' ? '+' : '−';

export const receiptAmount = (transaction: Transaction, account?: Account | null): string =>
  formatCurrency(transaction.amount, transaction.currency || account?.currency || 'PHP');

export const printTransactionReceipt = (
  transaction: Transaction,
  account?: Account | null,
): boolean => {
  const printWindow = window.open('', '_blank', 'width=440,height=760');

  if (!printWindow) return false;

  const currency = transaction.currency || account?.currency || 'PHP';
  const amount = `${receiptAmountPrefix(transaction.type)}${formatCurrency(transaction.amount, currency)}`;
  const rows: Array<[string, string]> = [
    ['Reference', transaction.reference],
    ['Date', formatDateTime(transaction.createdAt)],
    ['Account', account?.label ?? '—'],
    ['Account number', account ? formatAccountNumber(account.accountNumber) : '—'],
    ['Type', receiptTypeLabel(transaction.type)],
    ['Status', transaction.status],
  ];

  if (transaction.counterparty) rows.push(['Recipient', transaction.counterparty]);
  if (transaction.note) rows.push(['Note', transaction.note]);
  if (typeof transaction.balanceAfter === 'number') {
    rows.push(['Balance after', formatCurrency(transaction.balanceAfter, currency)]);
  }

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <div class="row">
          <span class="label">${escapeHtml(label)}</span>
          <span class="value">${escapeHtml(value)}</span>
        </div>`,
    )
    .join('');

  printWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Gellybank receipt ${escapeHtml(transaction.reference)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 32px 24px;
        background: #fffcf7;
        color: #30292c;
        font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .receipt {
        width: 100%;
        max-width: 360px;
        margin: 0 auto;
        padding: 28px;
        border: 1px solid #f2ece7;
        border-radius: 24px;
        background: #ffffff;
      }
      .brand {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }
      .brand-name { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
      .brand-sub { color: #9c9496; font-size: 12px; }
      .title { margin: 0; font-size: 15px; font-weight: 600; }
      .status {
        display: inline-block;
        margin-top: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        background: #ecfdf5;
        color: #047857;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .amount {
        margin: 8px 0 20px;
        font-size: 34px;
        font-weight: 800;
        letter-spacing: -0.03em;
      }
      .divider {
        margin: 0 0 8px;
        border: 0;
        border-top: 1px dashed #d8d0cb;
      }
      .row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 0;
        border-bottom: 1px dashed #eee7e2;
        font-size: 12px;
        line-height: 1.45;
      }
      .row:last-child { border-bottom: 0; }
      .label { color: #9c9496; }
      .value { max-width: 60%; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
      .footer {
        margin-top: 22px;
        padding-top: 16px;
        border-top: 1px solid #f2ece7;
        color: #9c9496;
        font-size: 11px;
        line-height: 1.5;
        text-align: center;
      }
      @media print {
        body { padding: 0; background: #fff; }
        .receipt { border: 0; border-radius: 0; max-width: none; }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <div class="brand">
        <div>
          <div class="brand-name">Gellybank</div>
          <div class="brand-sub">Transaction receipt</div>
        </div>
        <div class="title">${escapeHtml(receiptTypeLabel(transaction.type))}</div>
      </div>
      <span class="status">${escapeHtml(transaction.status)}</span>
      <div class="amount">${escapeHtml(amount)}</div>
      <hr class="divider" />
      ${rowsHtml}
      <div class="footer">
        This serves as your official transaction receipt.<br />
        Thank you for banking with Gellybank.
      </div>
    </main>
    <script>window.addEventListener('load', () => window.print());</script>
  </body>
</html>`);
  printWindow.document.close();

  return true;
};
