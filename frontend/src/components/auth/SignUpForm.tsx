import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import PasswordField from '@/components/auth/PasswordField';
import PhoneField from '@/components/auth/PhoneField';
import {
  DEFAULT_COUNTRY_CODE,
  findCountry,
  validatePhone,
} from '@/utils/countries';
import { confirmMatch, email, makeBirthdate, name, optionalName, password, required } from '@/utils/validation';

export interface SignUpDetails {
  firstName: string;
  middleName: string;
  lastName: string;
  birthdate: string;
  email: string;
  countryCode: string;
  phone: string;
  address: string;
  sourceOfFunds: string;
  accountType: 'savings' | 'checking';
  purposeOfAccount: string;
  password: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptAiInsights: boolean;
}

interface FormState extends SignUpDetails {
  confirmPassword: string;
}

type FieldKey = keyof FormState;

const SOURCE_OPTIONS = [
  'Employment income',
  'Business income',
  'Savings',
  'Investments',
  'Family support',
  'Pension',
  'Allowance',
  'Other',
];

const PURPOSE_OPTIONS = [
  'Personal savings',
  'Daily spending',
  'Business',
  'Bills & utilities',
  'Travel',
  'Education',
  'Other',
];

const emptyValues = (): FormState => ({
  firstName: '',
  middleName: '',
  lastName: '',
  birthdate: '',
  email: '',
  countryCode: DEFAULT_COUNTRY_CODE,
  phone: '',
  address: '',
  sourceOfFunds: '',
  accountType: 'savings',
  purposeOfAccount: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
  acceptPrivacy: false,
  acceptAiInsights: false,
});

const validateField = (field: FieldKey, values: FormState): string | undefined => {
  switch (field) {
    case 'firstName':
      return name('First name')(values.firstName);
    case 'middleName':
      return optionalName('Middle name')(values.middleName);
    case 'lastName':
      return name('Last name')(values.lastName);
    case 'birthdate':
      return makeBirthdate()(values.birthdate);
    case 'email':
      return email(values.email);
    case 'phone':
      return validatePhone(findCountry(values.countryCode), values.phone);
    case 'address':
      return required('Address')(values.address);
    case 'sourceOfFunds':
      return required('Source of funds')(values.sourceOfFunds);
    case 'accountType':
      return required('Account type')(values.accountType);
    case 'purposeOfAccount':
      return required('Purpose of account')(values.purposeOfAccount);
    case 'password':
      return password(values.password);
    case 'confirmPassword':
      return confirmMatch(values.password)(values.confirmPassword);
    case 'acceptTerms':
      return values.acceptTerms
        ? undefined
        : 'Confirm that you are at least 18 years old and agree to the Terms of Agreement.';
    case 'acceptPrivacy':
      return values.acceptPrivacy
        ? undefined
        : 'You must read the Data Privacy Notice and consent to the processing of your personal data.';
    case 'acceptAiInsights':
      return undefined;
    default:
      return undefined;
  }
};

const ALL_FIELDS = Object.keys(emptyValues()) as FieldKey[];

const STEPS: Array<{ title: string; fields: FieldKey[] }> = [
  {
    title: 'Personal information',
    fields: ['firstName', 'middleName', 'lastName', 'birthdate', 'email', 'phone', 'address'],
  },
  {
    title: 'Financial information',
    fields: ['sourceOfFunds', 'accountType', 'purposeOfAccount'],
  },
  {
    title: 'Security',
    fields: ['password', 'confirmPassword', 'acceptTerms', 'acceptPrivacy', 'acceptAiInsights'],
  },
];

interface SignUpFormProps {
  onSubmit: (details: SignUpDetails) => void;
  error?: string;
  submitting?: boolean;
}

const SectionTitle = ({ children }: { children: string }) => (
  <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
    {children}
  </h2>
);

const SignUpForm = ({ onSubmit, error, submitting = false }: SignUpFormProps) => {
  const [values, setValues] = useState<FormState>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const isLastStep = stepIndex === STEPS.length - 1;

  const update = <K extends FieldKey>(field: K, value: FormState[K]) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const validateOne = (field: FieldKey) =>
    setErrors((previous) => ({ ...previous, [field]: validateField(field, values) }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Partial<Record<FieldKey, string>> = {};
    for (const field of isLastStep ? ALL_FIELDS : STEPS[stepIndex].fields) {
      const error = validateField(field, values);
      if (error) nextErrors[field] = error;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (isLastStep) {
        const failingStep = STEPS.findIndex((step) =>
          step.fields.some((field) => nextErrors[field]),
        );
        if (failingStep >= 0) setStepIndex(failingStep);
      }
      return;
    }

    if (!isLastStep) {
      setStepIndex(stepIndex + 1);
      return;
    }

    const { confirmPassword: _confirm, ...details } = values;
    onSubmit(details);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-[28px] font-bold leading-[1.21] text-ink">Sign Up</h1>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium leading-[1.21] text-muted">
          Step {stepIndex + 1} of {STEPS.length}
        </span>
        <div className="flex gap-2" aria-hidden="true">
          {STEPS.map((step, index) => (
            <span
              key={step.title}
              className={`h-1.5 flex-1 rounded-full ${
                index <= stepIndex ? 'bg-primary' : 'bg-surface-line'
              }`}
            />
          ))}
        </div>
      </div>

      <SectionTitle>{STEPS[stepIndex].title}</SectionTitle>

      {stepIndex === 0 && (
        <>
          <Field label="First Name" error={errors.firstName}>
            <Input
              value={values.firstName}
              onChange={(event) => update('firstName', event.target.value)}
              onBlur={() => validateOne('firstName')}
              placeholder="Juan"
              autoComplete="given-name"
            />
          </Field>

          <Field label="Middle Name (Optional)" error={errors.middleName}>
            <Input
              value={values.middleName}
              onChange={(event) => update('middleName', event.target.value)}
              onBlur={() => validateOne('middleName')}
              placeholder="Santos"
              autoComplete="additional-name"
            />
          </Field>

          <Field label="Last Name" error={errors.lastName}>
            <Input
              value={values.lastName}
              onChange={(event) => update('lastName', event.target.value)}
              onBlur={() => validateOne('lastName')}
              placeholder="Dela Cruz"
              autoComplete="family-name"
            />
          </Field>

          <Field label="Birthdate" error={errors.birthdate}>
            <Input
              type="date"
              value={values.birthdate}
              max={today}
              onChange={(event) => update('birthdate', event.target.value)}
              onBlur={() => validateOne('birthdate')}
            />
          </Field>

          <Field label="Email address" error={errors.email}>
            <Input
              type="email"
              value={values.email}
              onChange={(event) => update('email', event.target.value)}
              onBlur={() => validateOne('email')}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </Field>

          <PhoneField
            countryCode={values.countryCode}
            number={values.phone}
            onCountryChange={(code) => {
              update('countryCode', code);
              setErrors((previous) => ({ ...previous, phone: undefined }));
            }}
            onNumberChange={(value) => update('phone', value)}
            error={errors.phone}
          />

          <Field label="Home address" error={errors.address}>
            <Textarea
              value={values.address}
              onChange={(event) => update('address', event.target.value)}
              onBlur={() => validateOne('address')}
              placeholder="Street, Barangay, City, Province, Postal code"
              autoComplete="street-address"
            />
          </Field>
        </>
      )}

      {stepIndex === 1 && (
        <>
          <Field label="Source of funds" error={errors.sourceOfFunds}>
            <Select
              value={values.sourceOfFunds}
              onChange={(event) => update('sourceOfFunds', event.target.value)}
              onBlur={() => validateOne('sourceOfFunds')}
            >
              <option value="">Select source of funds</option>
              {SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Account type" error={errors.accountType}>
            <Select
              value={values.accountType}
              onChange={(event) => update('accountType', event.target.value as SignUpDetails['accountType'])}
            >
              <option value="savings">Savings</option>
              <option value="checking">Checking</option>
            </Select>
          </Field>

          <Field label="Purpose of account" error={errors.purposeOfAccount}>
            <Select
              value={values.purposeOfAccount}
              onChange={(event) => update('purposeOfAccount', event.target.value)}
              onBlur={() => validateOne('purposeOfAccount')}
            >
              <option value="">Select purpose of account</option>
              {PURPOSE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </>
      )}

      {stepIndex === 2 && (
        <>
          <PasswordField
            label="Create Password"
            value={values.password}
            onChange={(value) => update('password', value)}
            autoComplete="new-password"
            error={errors.password}
          />

          <PasswordField
            label="Confirm Password"
            value={values.confirmPassword}
            onChange={(value) => update('confirmPassword', value)}
            autoComplete="new-password"
            error={errors.confirmPassword}
          />

          <label className="flex items-start gap-2 text-[13px] leading-[1.3] text-ink">
            <input
              type="checkbox"
              checked={values.acceptTerms}
              onChange={(event) => update('acceptTerms', event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-semibold">Required.</span> I am at least 18 years old. I have read
              and agree to the Gelly Bank{' '}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Terms of Agreement
              </Link>{' '}
              (Part A).
            </span>
          </label>

          <label className="flex items-start gap-2 text-[13px] leading-[1.3] text-ink">
            <input
              type="checkbox"
              checked={values.acceptPrivacy}
              onChange={(event) => update('acceptPrivacy', event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-semibold">Required.</span> I have read the{' '}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                Data Privacy Notice
              </Link>{' '}
              (Part B). I consent to Gelly Bank collecting and processing my personal data, including my
              government-issued ID information, to open and run my account, verify my identity and meet
              legal requirements.
            </span>
          </label>

          <label className="flex items-start gap-2 text-[13px] leading-[1.3] text-ink">
            <input
              type="checkbox"
              checked={values.acceptAiInsights}
              onChange={(event) => update('acceptAiInsights', event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-semibold">Optional.</span> I agree to Gelly Bank analysing my
              transaction records within its own systems to show me AI Insights. I can withdraw this at
              any time. Declining does not affect my banking services.
            </span>
          </label>
          {(errors.acceptTerms || errors.acceptPrivacy) && (
            <span className="text-[12px] leading-[1.21] text-red-600">
              {errors.acceptTerms ?? errors.acceptPrivacy}
            </span>
          )}
        </>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-[16px] bg-red-50 px-4 py-2.5 text-[13px] leading-[1.21] text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-2 flex gap-3">
        {stepIndex > 0 && (
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => setStepIndex(stepIndex - 1)}
            className="h-[56px] flex-1 justify-center text-[17px] font-semibold"
          >
            Back
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || (isLastStep && !(values.acceptTerms && values.acceptPrivacy))}
          className="h-[56px] flex-1 justify-center text-[17px] font-semibold"
        >
          {submitting ? 'Creating account…' : isLastStep ? 'Create account' : 'Next'}
        </Button>
      </div>
    </form>
  );
};

export default SignUpForm;
