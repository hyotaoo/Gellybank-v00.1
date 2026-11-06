import type { SignupStepProps } from '@/components/auth/signup';
import { CITIZENSHIP_STATUSES, SUFFIXES, US_STATES } from '@/components/auth/signup';
import { SignupField, SignupInput, SignupSelect } from '@/components/auth/SignupField';

// Figma 2196:563 — nine rows, 254px paired fields, 16px gutter
const SignupStepOne = ({ values, errors, update }: SignupStepProps) => (
  <div className="flex flex-col gap-2">
    <div className="flex gap-4">
      <SignupField label="First Name*" error={errors.firstName} className="min-w-0 flex-1">
        <SignupInput
          value={values.firstName}
          onChange={(event) => update('firstName', event.target.value)}
          placeholder="Juan"
          autoComplete="given-name"
        />
      </SignupField>
      <SignupField label="Middle Name (optional)" className="min-w-0 flex-1">
        <SignupInput
          value={values.middleName}
          onChange={(event) => update('middleName', event.target.value)}
          placeholder="Carlos"
          autoComplete="additional-name"
        />
      </SignupField>
    </div>

    <div className="flex gap-4">
      <SignupField label="Last Name*" error={errors.lastName} className="min-w-0 flex-1">
        <SignupInput
          value={values.lastName}
          onChange={(event) => update('lastName', event.target.value)}
          placeholder="Garcia"
          autoComplete="family-name"
        />
      </SignupField>
      <SignupField label="Suffix (optional)" className="min-w-0 flex-1">
        <SignupSelect
          value={values.suffix}
          onChange={(event) => update('suffix', event.target.value)}
          aria-label="Suffix"
        >
          <option value="">Select</option>
          {SUFFIXES.filter(Boolean).map((suffix) => (
            <option key={suffix} value={suffix}>
              {suffix}
            </option>
          ))}
        </SignupSelect>
      </SignupField>
    </div>

    <SignupField label="Date of Birth*" error={errors.birthdate}>
      <SignupInput
        type="date"
        value={values.birthdate}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(event) => update('birthdate', event.target.value)}
        autoComplete="bday"
      />
    </SignupField>

    <SignupField label="Address*" error={errors.address}>
      <SignupInput
        value={values.address}
        onChange={(event) => update('address', event.target.value)}
        placeholder="123 Main Street"
        autoComplete="address-line1"
      />
    </SignupField>

    <div className="flex gap-4">
      <SignupField label="City*" error={errors.city} className="min-w-0 flex-1">
        <SignupInput
          value={values.city}
          onChange={(event) => update('city', event.target.value)}
          placeholder="San Francisco"
          autoComplete="address-level2"
        />
      </SignupField>
      <SignupField
        label="State / Province / Region*"
        error={errors.state}
        className="min-w-0 flex-1"
      >
        <SignupSelect
          value={values.state}
          onChange={(event) => update('state', event.target.value)}
          autoComplete="address-level1"
        >
          <option value="">Select</option>
          {US_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </SignupSelect>
      </SignupField>
    </div>

    <SignupField label="ZIP / Postal Code*" error={errors.zip}>
      <SignupInput
        value={values.zip}
        onChange={(event) => update('zip', event.target.value)}
        placeholder="94105"
        autoComplete="postal-code"
      />
    </SignupField>

    <SignupField label="Mailing Address Same as Residential?*" error={errors.mailingSame}>
      <SignupSelect
        value={values.mailingSame}
        onChange={(event) => update('mailingSame', event.target.value)}
      >
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </SignupSelect>
    </SignupField>

    <div className="flex gap-4">
      <SignupField label="Email Address*" error={errors.email} className="min-w-0 flex-1">
        <SignupInput
          type="email"
          value={values.email}
          onChange={(event) => update('email', event.target.value)}
          placeholder="juan.garcia@example.com"
          autoComplete="email"
        />
      </SignupField>
      <SignupField label="Mobile Phone Number*" error={errors.phone} className="min-w-0 flex-1">
        <SignupInput
          type="tel"
          value={values.phone}
          onChange={(event) => update('phone', event.target.value)}
          placeholder="(555) 019-2834"
          autoComplete="tel"
          inputMode="tel"
        />
      </SignupField>
    </div>

    <SignupField label="Citizenship Status*" error={errors.citizenship}>
      <SignupSelect
        value={values.citizenship}
        onChange={(event) => update('citizenship', event.target.value)}
      >
        {CITIZENSHIP_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </SignupSelect>
    </SignupField>
  </div>
);

export default SignupStepOne;