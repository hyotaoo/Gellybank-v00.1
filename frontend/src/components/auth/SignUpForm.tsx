import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import PasswordField from '@/components/auth/PasswordField';
import PhoneField from '@/components/auth/PhoneField';
import {
  DEFAULT_COUNTRY_CODE,
  findCountry,
  validatePhone,
} from '@/utils/countries';
import {
  amount,
  confirmMatch,
  email,
  makeBirthdate,
  name,
  optionalName,
  optionalShortName,
  password,
  postalCode,
  required,
  sanitizeAmount,
  sanitizeName,
} from '@/utils/validation';
import { loadSignUpDraft, saveSignUpDraft } from '@/utils/signupDraft';

export interface SignUpDetails {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  birthdate: string;
  civilStatus: string;
  address: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  mailingSameAsResidential: boolean;
  email: string;
  countryCode: string;
  phone: string;
  employmentStatus: string;
  occupation: string;
  employerName: string;
  annualGrossIncome: string;
  sourceOfFunds: string;
  accountType: 'savings' | 'checking';
  accountOwnershipType: string;
  purposeOfAccount: string;
  password: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

interface FormState extends SignUpDetails {
  confirmPassword: string;
}

type FieldKey = keyof FormState;

const CIVIL_STATUS_OPTIONS = [
  'Single',
  'Married',
  'Widowed',
  'Separated',
  'Annulled',
  'Divorced',
];

const EMPLOYMENT_STATUS_OPTIONS = [
  'Employed',
  'Self-employed',
  'Unemployed',
  'Retired',
  'Student',
];

const EMPLOYERS_REQUIRED = ['Employed', 'Self-employed'];

const OWNERSHIP_OPTIONS = ['Individual', 'Joint'];

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
  suffix: '',
  birthdate: '',
  civilStatus: '',
  address: '',
  city: '',
  stateRegion: '',
  postalCode: '',
  mailingSameAsResidential: false,
  email: '',
  countryCode: DEFAULT_COUNTRY_CODE,
  phone: '',
  employmentStatus: '',
  occupation: '',
  employerName: '',
  annualGrossIncome: '',
  sourceOfFunds: '',
  accountType: 'savings',
  accountOwnershipType: '',
  purposeOfAccount: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
  acceptPrivacy: false,
});

const validateField = (field: FieldKey, values: FormState): string | undefined => {
  switch (field) {
    case 'firstName':
      return name('First name')(values.firstName);
    case 'middleName':
      return optionalName('Middle name')(values.middleName);
    case 'lastName':
      return name('Last name')(values.lastName);
    case 'suffix':
      return optionalShortName('Suffix')(values.suffix);
    case 'birthdate':
      return makeBirthdate()(values.birthdate);
    case 'civilStatus':
      return required('Civil status')(values.civilStatus);
    case 'email':
      return email(values.email);
    case 'phone':
      return validatePhone(findCountry(values.countryCode), values.phone);
    case 'address':
      return required('Address')(values.address);
    case 'city':
      return name('City')(values.city);
    case 'stateRegion':
      return name('State / Province / Region')(values.stateRegion);
    case 'postalCode':
      return postalCode(values.postalCode);
    case 'employmentStatus':
      return required('Employment status')(values.employmentStatus);
    case 'occupation':
      return required('Occupation / Job title')(values.occupation);
    case 'employerName':
      return EMPLOYERS_REQUIRED.includes(values.employmentStatus)
        ? required('Employer name')(values.employerName)
        : undefined;
    case 'annualGrossIncome':
      return amount('Annual gross income')(values.annualGrossIncome);
    case 'accountOwnershipType':
      return required('Account ownership type')(values.accountOwnershipType);
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
    default:
      return undefined;
  }
};

const ALL_FIELDS = Object.keys(emptyValues()) as FieldKey[];

const STEPS: Array<{ title: string; fields: FieldKey[] }> = [
  {
    title: 'Personal',
    fields: [
      'firstName',
      'middleName',
      'lastName',
      'suffix',
      'birthdate',
      'civilStatus',
      'address',
      'city',
      'stateRegion',
      'postalCode',
      'mailingSameAsResidential',
      'email',
      'phone',
    ],
  },
  {
    title: 'Financial',
    fields: [
      'employmentStatus',
      'occupation',
      'employerName',
      'annualGrossIncome',
      'sourceOfFunds',
      'accountType',
      'accountOwnershipType',
      'purposeOfAccount',
    ],
  },
  {
    title: 'Terms',
    fields: ['password', 'confirmPassword', 'acceptTerms', 'acceptPrivacy'],
  },
];

interface SignUpFormProps {
  onSubmit: (details: SignUpDetails) => void;
  error?: string;
  submitting?: boolean;
}

const SignUpForm = ({ onSubmit, error, submitting = false }: SignUpFormProps) => {
  const [draft] = useState(() => loadSignUpDraft(emptyValues(), STEPS.length));
  const [values, setValues] = useState<FormState>(() => draft?.values ?? emptyValues());
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [stepIndex, setStepIndex] = useState(() => draft?.stepIndex ?? 0);
  const today = new Date().toISOString().slice(0, 10);
  const isLastStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    saveSignUpDraft(values, stepIndex);
  }, [values, stepIndex]);

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
      <h1 className="text-center text-[28px] font-bold leading-[1.21] text-ink">Sign Up</h1>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {STEPS.map((step, index) => (
          <span
            key={step.title}
            className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-semibold leading-[14px] sm:px-3 sm:text-[12px] ${
              index === stepIndex
                ? 'border-primary bg-primary text-surface-card'
                : 'border-surface-line text-muted'
            }`}
          >
            <span>{index + 1}</span>
            <span>{step.title}</span>
          </span>
        ))}
      </div>

      {stepIndex === 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Field label="First Name" error={errors.firstName}>
              <Input
                value={values.firstName}
                onChange={(event) => update('firstName', sanitizeName(event.target.value))}
                onBlur={() => validateOne('firstName')}
                placeholder="Juan"
                autoComplete="given-name"
              />
            </Field>

            <Field label="Middle Name (Optional)" error={errors.middleName}>
              <Input
                value={values.middleName}
                onChange={(event) => update('middleName', sanitizeName(event.target.value))}
                onBlur={() => validateOne('middleName')}
                placeholder="Santos"
                autoComplete="additional-name"
              />
            </Field>

            <Field label="Last Name" error={errors.lastName}>
              <Input
                value={values.lastName}
                onChange={(event) => update('lastName', sanitizeName(event.target.value))}
                onBlur={() => validateOne('lastName')}
                placeholder="Dela Cruz"
                autoComplete="family-name"
              />
            </Field>

            <Field label="Suffix (Optional)" error={errors.suffix}>
              <Input
                value={values.suffix}
                onChange={(event) => update('suffix', sanitizeName(event.target.value).slice(0, 10))}
                onBlur={() => validateOne('suffix')}
                placeholder="Jr."
                autoComplete="honorific-suffix"
              />
            </Field>
          </div>

          <Field label="Birthdate" error={errors.birthdate}>
            <Input
              type="date"
              value={values.birthdate}
              max={today}
              onChange={(event) => update('birthdate', event.target.value)}
              onBlur={() => validateOne('birthdate')}
            />
          </Field>

          <Field label="Civil Status" error={errors.civilStatus}>
            <Select
              value={values.civilStatus}
              onChange={(event) => update('civilStatus', event.target.value)}
              onBlur={() => validateOne('civilStatus')}
            >
              <option value="">Select civil status</option>
              {CIVIL_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Address" error={errors.address}>
            <Input
              value={values.address}
              onChange={(event) => update('address', event.target.value)}
              onBlur={() => validateOne('address')}
              placeholder="Street, Barangay, Building"
              autoComplete="address-line1"
            />
          </Field>

          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Field label="City" error={errors.city}>
              <Input
                value={values.city}
                onChange={(event) => update('city', sanitizeName(event.target.value))}
                onBlur={() => validateOne('city')}
                placeholder="Quezon City"
                autoComplete="address-level2"
              />
            </Field>

            <Field label="State / Province / Region" error={errors.stateRegion}>
              <Input
                value={values.stateRegion}
                onChange={(event) => update('stateRegion', sanitizeName(event.target.value))}
                onBlur={() => validateOne('stateRegion')}
                placeholder="Metro Manila"
                autoComplete="address-level1"
              />
            </Field>
          </div>

          <Field label="ZIP / Postal Code" error={errors.postalCode}>
            <Input
              value={values.postalCode}
              onChange={(event) =>
                update('postalCode', event.target.value.replace(/\D/g, '').slice(0, 4))
              }
              onBlur={() => validateOne('postalCode')}
              placeholder="1100"
              inputMode="numeric"
              autoComplete="postal-code"
            />
          </Field>

          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
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
              number={values.phone}
              onNumberChange={(value) => update('phone', value)}
              error={errors.phone}
            />
          </div>
        </div>
      )}

      {stepIndex === 1 && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Field label="Employment Status" error={errors.employmentStatus}>
              <Select
                value={values.employmentStatus}
                onChange={(event) => {
                  update('employmentStatus', event.target.value);
                  setErrors((previous) => ({ ...previous, employerName: undefined }));
                }}
                onBlur={() => validateOne('employmentStatus')}
              >
                <option value="">Select employment status</option>
                {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Occupation / Job Title" error={errors.occupation}>
              <Input
                value={values.occupation}
                onChange={(event) => update('occupation', event.target.value)}
                onBlur={() => validateOne('occupation')}
                placeholder="Software Developer"
                autoComplete="organization-title"
              />
            </Field>
          </div>

          <Field label="Employer Name (required if employed)" error={errors.employerName}>
            <Input
              value={values.employerName}
              onChange={(event) => update('employerName', event.target.value)}
              onBlur={() => validateOne('employerName')}
              placeholder="Gelly Bank"
              autoComplete="organization"
            />
          </Field>

          <Field label="Annual Gross Income" error={errors.annualGrossIncome}>
            <Input
              value={values.annualGrossIncome}
              onChange={(event) => update('annualGrossIncome', sanitizeAmount(event.target.value))}
              onBlur={() => validateOne('annualGrossIncome')}
              placeholder="0.00"
              inputMode="decimal"
            />
          </Field>

          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
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
          </div>

          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <Field label="Account Ownership Type" error={errors.accountOwnershipType}>
              <Select
                value={values.accountOwnershipType}
                onChange={(event) => update('accountOwnershipType', event.target.value)}
                onBlur={() => validateOne('accountOwnershipType')}
              >
                <option value="">Select ownership type</option>
                {OWNERSHIP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
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
          </div>
        </div>
      )}

      {stepIndex === 2 && (
        <div className="flex flex-col gap-2">
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
                className="font-semibold text-primary hover:underline"
              >
                Data Privacy Notice
              </Link>{' '}
              (Part B). I consent to Gelly Bank collecting and processing my personal data, including my
              government-issued ID information, to open and run my account, verify my identity and meet
              legal requirements.
            </span>
          </label>

          {(errors.acceptTerms || errors.acceptPrivacy) && (
            <span className="text-[12px] leading-[1.21] text-red-600">
              {errors.acceptTerms ?? errors.acceptPrivacy}
            </span>
          )}
        </div>
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
            variant="primary"
            disabled={submitting}
            onClick={() => setStepIndex(stepIndex - 1)}
            className="h-[56px] flex-1 justify-center text-[17px] font-semibold"
          >
            Previous
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
