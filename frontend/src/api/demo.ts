interface DemoAccount {
  id: string;
  accountNumber: string;
  type: 'savings' | 'checking';
  label: string;
  balance: number;
  currency: string;
  status: 'active' | 'closed';
  isPrimary: boolean;
  interestRate: number;
  overdraftLimit?: number;
  monthlyWithdrawalLimit?: number;
  withdrawalsThisMonth?: number;
  createdAt: string;
}

interface DemoTransaction {
  id: string;
  accountId: string;
  type: 'deposit' | 'withdraw' | 'transfer';
  amount: number;
  currency: string;
  note?: string;
  counterparty?: string;
  reference: string;
  status: 'completed' | 'void';
  createdAt: string;
  relatedAccountId?: string;
  transferId?: string;
}

interface DemoBeneficiary {
  id: string;
  name: string;
  accountNumber: string;
  bank?: string;
}

interface DemoCard {
  id: string;
  type: 'debit' | 'credit';
  last4: string;
  status: string;
}

interface DemoState {
  nextId: number;
  accounts: DemoAccount[];
  transactions: DemoTransaction[];
  beneficiaries: DemoBeneficiary[];
  cards: DemoCard[];
}

const STORAGE_KEY = 'gellybank.demoData';
const CURRENCY = 'PHP';

export class DemoApiError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'demo_error') {
    super(message);
    this.name = 'DemoApiError';
  }
}

const dateDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const newState = (): DemoState => {
  const checking: DemoAccount = {
    id: 'demo-account-1', accountNumber: '100020003001', type: 'checking', label: 'Checking',
    balance: 8500, currency: CURRENCY, status: 'active', isPrimary: true, interestRate: 0,
    overdraftLimit: 10000, createdAt: dateDaysAgo(180),
  };
  const savings: DemoAccount = {
    id: 'demo-account-2', accountNumber: '100020003002', type: 'savings', label: 'Savings',
    balance: 25000, currency: CURRENCY, status: 'active', isPrimary: false, interestRate: 0.03,
    monthlyWithdrawalLimit: 10, withdrawalsThisMonth: 2, createdAt: dateDaysAgo(120),
  };
  return {
    nextId: 10,
    accounts: [checking, savings],
    transactions: [
      { id: 'demo-transaction-1', accountId: checking.id, type: 'deposit', amount: 10000, currency: CURRENCY, note: 'Monthly salary', reference: 'TXN-DEMO1001', status: 'completed', createdAt: dateDaysAgo(8) },
      { id: 'demo-transaction-2', accountId: checking.id, type: 'withdraw', amount: 1500, currency: CURRENCY, note: 'Household bills', reference: 'TXN-DEMO1002', status: 'completed', createdAt: dateDaysAgo(5) },
      { id: 'demo-transaction-3', accountId: checking.id, type: 'withdraw', amount: 500, currency: CURRENCY, note: 'Groceries', reference: 'TXN-DEMO1003', status: 'completed', createdAt: dateDaysAgo(2) },
      { id: 'demo-transaction-4', accountId: savings.id, type: 'deposit', amount: 25000, currency: CURRENCY, note: 'Opening deposit', reference: 'TXN-DEMO1004', status: 'completed', createdAt: dateDaysAgo(120) },
      { id: 'demo-transaction-5', accountId: checking.id, type: 'deposit', amount: 500, currency: CURRENCY, note: 'Opening deposit', reference: 'TXN-DEMO1005', status: 'completed', createdAt: dateDaysAgo(180) },
    ],
    beneficiaries: [
      { id: 'demo-beneficiary-1', name: 'Maria Santos', accountNumber: '100020003099', bank: 'GellyBank' },
    ],
    cards: [],
  };
};

const loadState = (): DemoState => {
  if (typeof window === 'undefined') return newState();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as DemoState;
  } catch {
    // Start a fresh demo session if stored demo data is malformed.
  }
  return newState();
};

const saveState = (state: DemoState) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const nextId = (state: DemoState, prefix: string) => `${prefix}-${state.nextId++}`;
const newReference = () => `TXN-DEMO${Math.floor(100000 + Math.random() * 900000)}`;
const money = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new DemoApiError('Enter an amount greater than zero.', 400, 'invalid_amount');
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const findAccount = (state: DemoState, id: string | undefined) => {
  const account = state.accounts.find((item) => item.id === id);
  if (!account) throw new DemoApiError('Account not found.', 404, 'not_found');
  return account;
};

const recordTransaction = (
  state: DemoState,
  account: DemoAccount,
  type: DemoTransaction['type'],
  amount: number,
  note?: string,
  counterparty?: string,
  relatedAccountId?: string,
  transferId?: string,
) => {
  const transaction: DemoTransaction = {
    id: nextId(state, 'demo-transaction'), accountId: account.id, type, amount, currency: account.currency,
    note: note?.trim() || undefined, counterparty, reference: newReference(), status: 'completed',
    createdAt: new Date().toISOString(), relatedAccountId, transferId,
  };
  state.transactions.push(transaction);
  return transaction;
};

const jsonCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const demoRequest = <T,>(path: string, method: string, body?: unknown): T => {
  const [pathname, queryString = ''] = path.split('?');
  const parts = pathname.split('/').filter(Boolean);
  const query = new URLSearchParams(queryString);
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const state = loadState();
  let result: unknown;
  let changed = false;

  if (parts[0] === 'accounts' && parts.length === 1 && method === 'GET') {
    result = state.accounts;
  } else if (parts[0] === 'accounts' && parts.length === 1 && method === 'POST') {
    const type = data.type === 'checking' ? 'checking' : 'savings';
    const account: DemoAccount = {
      id: nextId(state, 'demo-account'), accountNumber: String(Math.floor(1e11 + Math.random() * 9e11)),
      type, label: typeof data.label === 'string' && data.label.trim() ? data.label.trim() : type === 'savings' ? 'Savings' : 'Checking',
      balance: Math.max(0, Number(data.initialDeposit) || 0), currency: CURRENCY, status: 'active',
      isPrimary: Boolean(data.isPrimary) || state.accounts.length === 0,
      interestRate: type === 'savings' ? 0.03 : 0,
      ...(type === 'checking' ? { overdraftLimit: 10000 } : { monthlyWithdrawalLimit: 10, withdrawalsThisMonth: 0 }),
      createdAt: new Date().toISOString(),
    };
    if (account.isPrimary) state.accounts.forEach((item) => { item.isPrimary = false; });
    state.accounts.push(account);
    if (account.balance > 0) recordTransaction(state, account, 'deposit', account.balance, 'Opening deposit');
    result = account;
    changed = true;
  } else if (parts[0] === 'accounts' && parts.length === 2) {
    const account = findAccount(state, parts[1]);
    if (method === 'GET') result = account;
    else if (method === 'PATCH') {
      if (typeof data.label === 'string' && data.label.trim()) account.label = data.label.trim();
      if (data.isPrimary === true) {
        state.accounts.forEach((item) => { item.isPrimary = item.id === account.id; });
      }
      result = account;
      changed = true;
    } else if (method === 'DELETE') {
      if (account.balance !== 0) throw new DemoApiError('Account balance must be zero before closing.', 400, 'balance_not_zero');
      account.status = 'closed';
      if (account.isPrimary) {
        account.isPrimary = false;
        const replacement = state.accounts.find((item) => item.id !== account.id && item.status === 'active');
        if (replacement) replacement.isPrimary = true;
      }
      result = undefined;
      changed = true;
    }
  } else if (parts[0] === 'transactions' && parts.length === 1 && method === 'GET') {
    const accountId = query.get('accountId');
    const limit = Number(query.get('limit'));
    result = state.transactions
      .filter((item) => !accountId || item.accountId === accountId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit > 0 ? limit : state.transactions.length);
  } else if (parts[0] === 'transactions' && parts[1] === 'transfer' && method === 'POST') {
    const source = findAccount(state, String(data.sourceAccountId ?? ''));
    if (source.status !== 'active') throw new DemoApiError('This account is not active.', 400, 'account_inactive');
    const amount = money(data.amount);
    if (amount > source.balance) throw new DemoApiError('Insufficient funds.', 400, 'insufficient_funds');
    const note = typeof data.note === 'string' ? data.note : undefined;
    let destination: DemoAccount | undefined;
    let counterparty: string | undefined;
    if (typeof data.destinationAccountId === 'string') {
      destination = findAccount(state, data.destinationAccountId);
      if (destination.id === source.id) throw new DemoApiError('Choose a different destination account.', 400, 'same_account');
      if (destination.status !== 'active') throw new DemoApiError('The destination account is not active.', 400, 'destination_inactive');
      counterparty = destination.label;
    } else {
      const beneficiary = state.beneficiaries.find((item) => item.id === data.beneficiaryId);
      if (!beneficiary) throw new DemoApiError('Recipient not found.', 404, 'not_found');
      counterparty = beneficiary.name;
    }
    source.balance -= amount;
    const transferId = nextId(state, 'demo-transfer');
    const tx = recordTransaction(state, source, 'transfer', amount, note, counterparty, destination?.id, transferId);
    if (destination) {
      destination.balance += amount;
      recordTransaction(state, destination, 'deposit', amount, note || `Transfer from ${source.label}`, source.label, source.id, transferId);
    }
    result = tx;
    changed = true;
  } else if (parts[0] === 'transactions' && parts.length === 1 && method === 'POST') {
    const account = findAccount(state, String(data.accountId ?? ''));
    if (account.status !== 'active') throw new DemoApiError('This account is not active.', 400, 'account_inactive');
    const amount = money(data.amount);
    const type = data.type === 'withdraw' ? 'withdraw' : 'deposit';
    if (type === 'withdraw' && amount > account.balance + (account.overdraftLimit ?? 0)) {
      throw new DemoApiError('Insufficient funds.', 400, 'insufficient_funds');
    }
    if (type === 'withdraw' && account.type === 'savings' && amount > account.balance) {
      throw new DemoApiError('Insufficient funds.', 400, 'insufficient_funds');
    }
    account.balance += type === 'deposit' ? amount : -amount;
    if (type === 'withdraw' && account.type === 'savings') account.withdrawalsThisMonth = (account.withdrawalsThisMonth ?? 0) + 1;
    result = recordTransaction(state, account, type, amount, typeof data.note === 'string' ? data.note : undefined);
    changed = true;
  } else if (parts[0] === 'transactions' && parts.length === 2) {
    const transaction = state.transactions.find((item) => item.id === parts[1]);
    if (!transaction) throw new DemoApiError('Transaction not found.', 404, 'not_found');
    if (method === 'PATCH') {
      transaction.note = typeof data.note === 'string' ? data.note.trim() || undefined : undefined;
      result = transaction;
      changed = true;
    } else if (method === 'DELETE' && transaction.status !== 'void') {
      const account = findAccount(state, transaction.accountId);
      if (transaction.type === 'deposit') {
        if (account.balance < transaction.amount) throw new DemoApiError('Cannot void: the funds have already been spent.', 400, 'insufficient_funds');
        account.balance -= transaction.amount;
      } else if (transaction.type === 'withdraw') {
        account.balance += transaction.amount;
      } else {
        account.balance += transaction.amount;
        if (transaction.relatedAccountId) {
          const destination = findAccount(state, transaction.relatedAccountId);
          if (destination.balance < transaction.amount) throw new DemoApiError('Cannot void: the recipient has already spent the funds.', 400, 'insufficient_funds');
          destination.balance -= transaction.amount;
        }
      }
      transaction.status = 'void';
      if (transaction.transferId) {
        state.transactions.forEach((item) => {
          if (item.transferId === transaction.transferId) item.status = 'void';
        });
      }
      result = undefined;
      changed = true;
    }
  } else if (parts[0] === 'beneficiaries' && parts.length === 1 && method === 'GET') {
    result = state.beneficiaries;
  } else if (parts[0] === 'beneficiaries' && parts.length === 1 && method === 'POST') {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const accountNumber = typeof data.accountNumber === 'string' ? data.accountNumber.trim() : '';
    if (!name || !accountNumber) throw new DemoApiError('Name and account number are required.', 400, 'invalid_input');
    const beneficiary = { id: nextId(state, 'demo-beneficiary'), name, accountNumber, bank: typeof data.bank === 'string' ? data.bank.trim() || undefined : undefined };
    state.beneficiaries.push(beneficiary);
    result = beneficiary;
    changed = true;
  } else if (parts[0] === 'beneficiaries' && parts.length === 2) {
    const index = state.beneficiaries.findIndex((item) => item.id === parts[1]);
    if (index < 0) throw new DemoApiError('Beneficiary not found.', 404, 'not_found');
    if (method === 'PATCH') {
      state.beneficiaries[index] = { ...state.beneficiaries[index], ...data } as DemoBeneficiary;
      result = state.beneficiaries[index];
      changed = true;
    } else if (method === 'DELETE') {
      state.beneficiaries.splice(index, 1);
      result = undefined;
      changed = true;
    }
  } else if (parts[0] === 'cards' && parts[1] === 'request' && method === 'POST') {
    const card: DemoCard = { id: nextId(state, 'demo-card'), type: data.cardType === 'credit' ? 'credit' : 'debit', last4: String(Math.floor(1000 + Math.random() * 9000)), status: 'active' };
    state.cards.push(card);
    result = card;
    changed = true;
  } else if (parts[0] === 'insights' && parts[1] === 'spending' && method === 'GET') {
    const accountId = query.get('accountId');
    const outgoing = state.transactions.filter((item) => item.status !== 'void' && (!accountId || item.accountId === accountId) && (item.type === 'withdraw' || item.type === 'transfer'));
    const totals = new Map<string, number>();
    outgoing.forEach((item) => {
      const label = item.note || (item.type === 'transfer' ? 'Transfers' : 'Other spending');
      totals.set(label, (totals.get(label) ?? 0) + item.amount);
    });
    const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
    result = {
      total,
      currency: CURRENCY,
      categories: [...totals.entries()].map(([label, amount]) => ({ label, amount, value: total ? Math.round((amount / total) * 100) : 0 })).sort((left, right) => right.amount - left.amount),
      tips: ['Review your biggest spending category each week.'],
    };
  } else {
    throw new DemoApiError('This demo action is not available.', 404, 'not_found');
  }

  if (changed) saveState(state);
  return jsonCopy(result) as T;
};
