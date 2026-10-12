export type Validator = (value: string) => string | undefined;

export const required = (label = 'This field'): Validator => (value) =>
  value.trim() ? undefined : `${label} is required.`;

export const email = (value: string): string | undefined => {
  if (!value.trim()) return 'Email address is required.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? undefined
    : 'Enter a valid email address.';
};

export const password = (value: string): string | undefined => {
  if (!value) return 'Password is required.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Include at least one letter and one number.';
  }
  return undefined;
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
