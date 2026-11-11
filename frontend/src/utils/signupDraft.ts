export const SIGNUP_DRAFT_KEY = 'gellybank.signup.draft';

const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const OMITTED_KEYS = ['password', 'confirmPassword'];

interface SignUpDraft<T> {
  values: T;
  stepIndex: number;
}

interface StoredDraft {
  version: number;
  savedAt: number;
  stepIndex: number;
  values: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const clearSignUpDraft = (): void => {
  try {
    window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    // Storage can be unavailable; nothing to clear.
  }
};

export const loadSignUpDraft = <T extends object>(
  defaults: T,
  stepCount: number,
): SignUpDraft<T> | null => {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(SIGNUP_DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearSignUpDraft();
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.version !== DRAFT_VERSION) {
    clearSignUpDraft();
    return null;
  }
  if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
    clearSignUpDraft();
    return null;
  }
  if (!isRecord(parsed.values)) return null;

  const values: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const key of Object.keys(values)) {
    if (OMITTED_KEYS.includes(key)) continue;
    const stored = parsed.values[key];
    if (typeof stored === typeof values[key]) values[key] = stored;
  }

  const stepIndex =
    typeof parsed.stepIndex === 'number' &&
    Number.isInteger(parsed.stepIndex) &&
    parsed.stepIndex >= 0 &&
    parsed.stepIndex < stepCount
      ? parsed.stepIndex
      : 0;

  return { values: values as T, stepIndex };
};

export const saveSignUpDraft = <T extends object>(values: T, stepIndex: number): void => {
  const draftValues: Record<string, unknown> = { ...(values as Record<string, unknown>) };
  for (const key of OMITTED_KEYS) delete draftValues[key];

  const payload: StoredDraft = {
    version: DRAFT_VERSION,
    savedAt: Date.now(),
    stepIndex,
    values: draftValues,
  };

  try {
    window.sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable or full; the form still works without a draft.
  }
};
