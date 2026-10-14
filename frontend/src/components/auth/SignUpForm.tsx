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

const SectionTitle = ({ children }: { children: string }) => (
  <p className="pt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-primary">
    {children}
  </p>
);

const SignUpForm = ({ onSubmit }: SignUpFormProps) => {
  const [values, setValues] = useState<FormState>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
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
    for (const field of ALL_FIELDS) {
      const error = validateField(field, values);
      if (error) nextErrors[field] = error;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const { confirmPassword: _confirm, ...details } = values;
    onSubmit(details);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-[28px] font-bold leading-[1.21] text-ink">Sign Up</h1>

      <SectionTitle>Personal information</SectionTitle>

      <Field label="First Name" error={errors.firstName}>
        <Input
          value={values.firstName}
          onChange={(event) => update('firstName', event.target.value)}
          onBlur={() => validateOne('firstName')}
          placeholder="Juan"
          autoComplete="given-name"
        />
      </Field>

      <Field label="Middle Name (Optional)">
        <Input
          value={values.middleName}
          onChange={(event) => update('middleName', event.target.value)}
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

      <SectionTitle>Financial information</SectionTitle>

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

      <SectionTitle>Security</SectionTitle>

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

      <Button
        type="submit"
        variant="primary"
        className="mt-2 h-[56px] w-full justify-center text-[17px] font-semibold"
      >
        Create account
      </Button>
    </form>
  );
};

export default SignUpForm;
