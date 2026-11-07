import type { SignupStepProps } from '@/components/auth/signup';
import {
  ACCOUNT_PURPOSES,
  ACCOUNT_TYPES,
  EMPLOYMENT_STATUSES,
  INCOME_RANGES,
  OWNERSHIP_TYPES,
  SOURCE_OF_FUNDS,
} from '@/components/auth/signup';
import {
  SignupField,
  SignupInput,
  SignupPassword,
  SignupSelect,
} from '@/components/auth/SignupField';

// Figma 2196:645 — seven rows, 254px paired fields, 16px gutter
const SignupStepTwo = ({ values, errors, update }: SignupStepProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex gap-4">
      <SignupField label="Employment Status*" error={errors.employmentStatus} className="min-w-0 flex-1">
        <SignupSelect
          value={values.employmentStatus}
          onChange={(event) => update('employmentStatus', event.target.value)}
        >
          <option value="">Select</option>
          {EMPLOYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SignupSelect>
      </SignupField>
      <SignupField
        label="Occupation / Job Title*"
        error={errors.occupation}
        className="min-w-0 flex-1"
      >
        <SignupInput
          value={values.occupation}
          onChange={(event) => update('occupation', event.target.value)}
          placeholder="Software Engineer"
          autoComplete="organization-title"
        />
      </SignupField>
    </div>

    <SignupField label="Employer Name (required if employed)" error={errors.employer}>
      <SignupInput
        value={values.employer}
        onChange={(event) => update('employer', event.target.value)}
        placeholder="LSPU"
        autoComplete="organization"
      />
    </SignupField>

    <SignupField label="Annual Gross Income*" error={errors.annualIncome}>
      <SignupSelect
        value={values.annualIncome}
        onChange={(event) => update('annualIncome', event.target.value)}
      >
        <option value="">Select</option>
        {INCOME_RANGES.map((range) => (
          <option key={range} value={range}>
            {range}
          </option>
        ))}
      </SignupSelect>
    </SignupField>

    <div className="flex gap-4">
      <SignupField
        label="Primary Source of Wealth / Funds*"
        error={errors.sourceOfFunds}
        className="min-w-0 flex-1"
      >
        <SignupSelect
          value={values.sourceOfFunds}
          onChange={(event) => update('sourceOfFunds', event.target.value)}
        >
          <option value="">Select</option>
          {SOURCE_OF_FUNDS.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </SignupSelect>
      </SignupField>
      <SignupField
        label="Account Type Selection*"
        error={errors.accountType}
        className="min-w-0 flex-1"
      >
        <SignupSelect
          value={values.accountType}
          onChange={(event) => update('accountType', event.target.value)}
        >
          <option value="">Select</option>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SignupSelect>
      </SignupField>
    </div>

    <div className="flex gap-4">
      <SignupField
        label="Account Ownership Type*"
        error={errors.ownershipType}
        className="min-w-0 flex-1"
      >
        <SignupSelect
          value={values.ownershipType}
          onChange={(event) => update('ownershipType', event.target.value)}
        >
          {OWNERSHIP_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SignupSelect>
      </SignupField>
      <SignupField
        label="Primary Purpose of Account*"
        error={errors.purposeOfAccount}
        className="min-w-0 flex-1"
      >
        <SignupSelect
          value={values.purposeOfAccount}
          onChange={(event) => update('purposeOfAccount', event.target.value)}
        >
          <option value="">Select</option>
          {ACCOUNT_PURPOSES.map((purpose) => (
            <option key={purpose} value={purpose}>
              {purpose}
            </option>
          ))}
        </SignupSelect>
      </SignupField>
    </div>

    <SignupField label="Create Password" error={errors.password}>
      <SignupPassword
        value={values.password}
        onChange={(value) => update('password', value)}
        autoComplete="new-password"
      />
    </SignupField>

    <SignupField label="Confirm Password" error={errors.confirmPassword}>
      <SignupPassword
        value={values.confirmPassword}
        onChange={(value) => update('confirmPassword', value)}
        autoComplete="new-password"
      />
    </SignupField>
  </div>
);

export default SignupStepTwo;