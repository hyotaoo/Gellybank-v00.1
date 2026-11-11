export type Validator = (value: string) => string | undefined;

export const required = (label = 'This field'): Validator => (value) =>
  value.trim() ? undefined : `${label} is required.`;

export const email = (value: string): string | undefined => {
  if (!value.trim()) return 'Email address is required.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? undefined
    : 'Enter a valid email address.';
};

export const PASSWORD_HINT =
  'Use 8+ characters with uppercase, lowercase, a number, a special character, and no spaces.';

export const password = (value: string, username?: string): string | undefined => {
  if (!value) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (/\s/.test(value)) return 'Password cannot contain spaces.';
  if (!/\p{Lu}/u.test(value)) return 'Password must include an uppercase letter.';
  if (!/\p{Ll}/u.test(value)) return 'Password must include a lowercase letter.';
  if (!/\p{Nd}/u.test(value)) return 'Password must include a number.';
  if (!/[^\p{L}\p{N}\s]/u.test(value)) {
    return 'Password must include a special character (for example ! @ # $ % & _).';
  }
  if (username) {
    const normalized = username.trim().toLowerCase();
    const candidate = value.toLowerCase();
    if (candidate === normalized || candidate === normalized.split('@')[0]) {
      return 'Password cannot be the same as your email or username.';
    }
  }
  return undefined;
};

const NAME_PATTERN = /^[\p{L} .'-]+$/u;

export const sanitizeName = (value: string): string => value.replace(/[^\p{L} .'-]/gu, '');

export const sanitizeAmount = (value: string): string => {
  const [whole, ...decimals] = value.replace(/[^\d.]/g, '').split('.');
  return decimals.length ? `${whole}.${decimals.join('').slice(0, 2)}` : whole;
};

export const name = (label = 'Name'): Validator => (value) => {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length < 2) return `${label} must be at least 2 characters.`;
  if (trimmed.length > 50) return `${label} must be 50 characters or fewer.`;
  return NAME_PATTERN.test(trimmed)
    ? undefined
    : `${label} can only contain letters, spaces, hyphens, apostrophes, and periods.`;
};

export const optionalName = (label = 'Name'): Validator => (value) =>
  value.trim() ? name(label)(value) : undefined;

export const optionalShortName =
  (label = 'Name', max = 10): Validator =>
  (value) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.length > max) return `${label} must be ${max} characters or fewer.`;
    return NAME_PATTERN.test(trimmed)
      ? undefined
      : `${label} can only contain letters, spaces, hyphens, apostrophes, and periods.`;
  };

export const postalCode = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return 'ZIP / Postal code is required.';
  return /^\d{4}$/.test(trimmed) ? undefined : 'Enter a 4-digit ZIP / postal code.';
};

export const amount = (label = 'Amount'): Validator => (value) => {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  return /^\d+(\.\d{1,2})?$/.test(trimmed) ? undefined : 'Enter a valid amount.';
};

export const confirmMatch =
  (original: string, label = 'Passwords'): Validator =>
  (value) => {
    if (!value) return 'Please confirm your password.';
    return value === original ? undefined : `${label} do not match.`;
  };

export const makeBirthdate = (minAge = 18): Validator => (value) => {
  if (!value) return 'Birthdate is required.';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Enter a valid date.';

  const now = new Date();
  if (date > now) return 'Birthdate cannot be in the future.';

  const years = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < minAge) return `You must be at least ${minAge} years old.`;
  if (years > 120) return 'Enter a valid birthdate.';
  return undefined;
};

export const runValidators = (
  value: string,
  validators: Validator[],
): string | undefined => {
  for (const validate of validators) {
    const error = validate(value);
    if (error) return error;
  }
  return undefined;
};
