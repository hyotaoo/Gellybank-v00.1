import { useState } from 'react';
import type { FormEvent } from 'react';
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
import { confirmMatch, email, makeBirthdate, password, required } from '@/utils/validation';

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
});

const validateField = (field: FieldKey, values: FormState): string | undefined => {
  switch (field) {
    case 'firstName':
      return required('First name')(values.firstName);
    case 'lastName':
      return required('Last name')(values.lastName);
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
    default:
      return undefined;
  }
};

const ALL_FIELDS = Object.keys(emptyValues()) as FieldKey[];

interface SignUpFormProps {
  onSubmit: (details: SignUpDetails) => void;
}

const SIGN_UP_STEPS = [
  { title: 'Personal'},
  { title: 'Financial'},
  { title: 'Security'},
] as const;

const STEP_FIELDS: FieldKey[][] = [
  ['firstName', 'lastName', 'birthdate', 'email', 'phone', 'address'],
  ['sourceOfFunds', 'accountType', 'purposeOfAccount'],
  ['password', 'confirmPassword'],
];

const SignUpForm = ({ onSubmit }: SignUpFormProps) => {
  const [values, setValues] = useState<FormState>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [step, setStep] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const update = <K extends FieldKey>(field: K, value: FormState[K]) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const validateOne = (field: FieldKey) =>
    setErrors((previous) => ({ ...previous, [field]: validateField(field, values) }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Partial<Record<FieldKey, string>> = {};
    for (const field of STEP_FIELDS[step]) {
      const error = validateField(field, values);
      if (error) nextErrors[field] = error;
    }

    setErrors((previous) => ({ ...previous, ...nextErrors }));
    if (Object.keys(nextErrors).length > 0) return;

    if (step < SIGN_UP_STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    const allErrors: Partial<Record<FieldKey, string>> = {};
    for (const field of ALL_FIELDS) {
      const error = validateField(field, values);
      if (error) allErrors[field] = error;
    }
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const firstInvalidStep = STEP_FIELDS.findIndex((fields) => fields.some((field) => allErrors[field]));
      if (firstInvalidStep >= 0) setStep(firstInvalidStep);
      return;
    }

    const { confirmPassword: _confirm, ...details } = values;
    onSubmit(details);
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-[620px] flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold leading-[1.21] text-ink">Create your account</h1>
        <p className="text-[14px] leading-[1.4] text-muted">Step {step + 1} of {SIGN_UP_STEPS.length}</p>
      </div>

      <nav aria-label="Sign-up progress" className="grid grid-cols-3 gap-2">
        {SIGN_UP_STEPS.map((item, index) => (
          <div key={item.title} aria-current={index === step ? 'step' : undefined} className="flex flex-col gap-2">
            <div className={`h-1.5 rounded-full ${index <= step ? 'bg-primary' : 'bg-surface-line'}`} />
          </div>
        ))}
      </nav>

      <div className="flex flex-1 flex-col gap-4" key={step}>
        <div className="flex flex-col gap-1">
          <h2 className="text-[18px] font-semibold text-ink">{SIGN_UP_STEPS[step].title} information</h2>
        </div>

        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" error={errors.firstName}>
                <Input value={values.firstName} onChange={(event) => update('firstName', event.target.value)} onBlur={() => validateOne('firstName')} placeholder="Juan" autoComplete="given-name" />
              </Field>
              <Field label="Last name" error={errors.lastName}>
                <Input value={values.lastName} onChange={(event) => update('lastName', event.target.value)} onBlur={() => validateOne('lastName')} placeholder="Dela Cruz" autoComplete="family-name" />
              </Field>
            </div>
            <Field label="Middle name (optional)">
              <Input value={values.middleName} onChange={(event) => update('middleName', event.target.value)} placeholder="Santos" autoComplete="additional-name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Birthdate" error={errors.birthdate}>
                <Input type="date" value={values.birthdate} max={today} onChange={(event) => update('birthdate', event.target.value)} onBlur={() => validateOne('birthdate')} />
              </Field>
              <Field label="Email address" error={errors.email}>
                <Input type="email" value={values.email} onChange={(event) => update('email', event.target.value)} onBlur={() => validateOne('email')} placeholder="name@example.com" autoComplete="email" />
              </Field>
            </div>
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
              <Textarea value={values.address} onChange={(event) => update('address', event.target.value)} onBlur={() => validateOne('address')} placeholder="Street, Barangay, City, Province, Postal code" autoComplete="street-address" />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Source of funds" error={errors.sourceOfFunds}>
              <Select value={values.sourceOfFunds} onChange={(event) => update('sourceOfFunds', event.target.value)} onBlur={() => validateOne('sourceOfFunds')}>
                <option value="">Select source of funds</option>
                {SOURCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
            <Field label="Account type" error={errors.accountType}>
              <Select value={values.accountType} onChange={(event) => update('accountType', event.target.value as SignUpDetails['accountType'])} onBlur={() => validateOne('accountType')}>
                <option value="savings">Savings</option>
                <option value="checking">Checking</option>
              </Select>
            </Field>
            <Field label="Purpose of account" error={errors.purposeOfAccount}>
              <Select value={values.purposeOfAccount} onChange={(event) => update('purposeOfAccount', event.target.value)} onBlur={() => validateOne('purposeOfAccount')}>
                <option value="">Select purpose of account</option>
                {PURPOSE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <PasswordField label="Create password" value={values.password} onChange={(value) => update('password', value)} autoComplete="new-password" error={errors.password} />
            <PasswordField label="Confirm password" value={values.confirmPassword} onChange={(value) => update('confirmPassword', value)} autoComplete="new-password" error={errors.confirmPassword} />
            <p className="rounded-[16px] bg-surface-input p-3 text-[12px] leading-[1.4] text-muted">
              Use at least 8 characters, including a letter and a number.
            </p>
          </>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-surface-line pt-4">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((current) => current - 1)} className="h-[50px] px-5 text-[15px] font-semibold">
            Back
          </Button>
        ) : <span />}
        <Button type="submit" variant="primary" className="h-[50px] min-w-[150px] justify-center px-5 text-[15px] font-semibold">
          {step === SIGN_UP_STEPS.length - 1 ? 'Continue to verification' : 'Continue'}
        </Button>
      </div>
    </form>
  );
};

export default SignUpForm;
