import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '@/api/auth';
import type { RegisterInput } from '@/api/auth';
import SignupCard from '@/components/auth/SignupCard';
import SignupLayout from '@/components/auth/SignupLayout';
import SignupStepOne from '@/components/auth/SignupStepOne';
import SignupStepThree from '@/components/auth/SignupStepThree';
import SignupStepTwo from '@/components/auth/SignupStepTwo';
import { emptySignupValues, validateStep } from '@/components/auth/signup';
import type {
  SignupErrors,
  SignupFieldKey,
  SignupStep,
  SignupValues,
} from '@/components/auth/signup';
import { findCountry } from '@/utils/countries';

const TITLES: Record<SignupStep, string> = {
  1: 'Personal Identification & Contact Details',
  2: 'Financial Profile & Account Setup',
  3: 'Terms, Conditions, Disclosures & Authorization',
};

const PRIMARY_BUTTON =
  'flex h-[43px] w-full items-center justify-center rounded-[37px] border border-rose-300 bg-[radial-gradient(circle_at_50%_51%,rgba(255,242,202,0.5)_0%,#FCE8EE_100%)] text-[20px] font-normal leading-[24px] text-[#331B29] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover';
const SECONDARY_BUTTON =
  'flex h-[43px] w-full items-center justify-center rounded-[37px] border border-[#F2ECE7] bg-white/[0.16] text-[20px] font-normal leading-[24px] text-ink transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover';
const DISABLED_BUTTON =
  'flex h-[43px] w-full items-center justify-center rounded-[37px] border border-[#F2ECE7] bg-[#F0E8EB] text-[20px] font-normal leading-[24px] text-[#6E6168]';

const toRegisterInput = (values: SignupValues): RegisterInput => ({
  firstName: values.firstName.trim(),
  middleName: values.middleName.trim() || undefined,
  lastName: values.lastName.trim(),
  suffix: values.suffix || undefined,
  birthdate: values.birthdate,
  email: values.email.trim().toLowerCase(),
  countryCode: findCountry(values.countryCode).dial,
  phone: values.phone.replace(/[\s-]/g, ''),
  address: values.address.trim(),
  city: values.city.trim(),
  state: values.state.trim(),
  zip: values.zip.trim(),
  mailingSame: values.mailingSame,
  citizenship: values.citizenship,
  employmentStatus: values.employmentStatus,
  occupation: values.occupation.trim(),
  employer: values.employer.trim() || undefined,
  annualIncome: values.annualIncome,
  sourceOfFunds: values.sourceOfFunds,
  accountType: values.accountType === 'Checking' ? 'checking' : 'savings',
  ownershipType: values.ownershipType,
  purposeOfAccount: values.purposeOfAccount,
  password: values.password,
  agreeTerms: values.agreeTerms,
  agreePrivacy: values.agreePrivacy,
  agreeInsights: values.agreeInsights,
});

const SignUpPage = () => {
  const navigate = useNavigate();
  const [values, setValues] = useState<SignupValues>(emptySignupValues);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [step, setStep] = useState<SignupStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const update = <K extends SignupFieldKey,>(field: K, value: SignupValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const current = values;
    const nextErrors = validateStep(step, current);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (step < 3) {
      setStep((step + 1) as SignupStep);
      return;
    }

    setSubmitting(true);
    setSubmitError(undefined);
    try {
      await register(toRegisterInput(values));
      navigate('/signin', {
        state: { registered: true, email: values.email.trim().toLowerCase() },
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to create your account. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const back = () => {
    setErrors({});
    if (step > 1) setStep((step - 1) as SignupStep);
  };

  const canCreate = values.agreeTerms && values.agreePrivacy;

  return (
    <SignupLayout>
      <SignupCard title={TITLES[step]} step={step}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {step === 1 && <SignupStepOne values={values} errors={errors} update={update} />}
          {step === 2 && <SignupStepTwo values={values} errors={errors} update={update} />}
          {step === 3 && <SignupStepThree values={values} errors={errors} update={update} />}

          <div className="flex flex-col gap-4">
            {step > 1 && (
              <button type="button" onClick={back} className={SECONDARY_BUTTON}>
                Back
              </button>
            )}

            {step < 3 ? (
              <button type="submit" className={PRIMARY_BUTTON}>
                Continue
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={!canCreate || submitting}
                  className={canCreate ? PRIMARY_BUTTON : DISABLED_BUTTON}
                >
                  {submitting ? 'Creating account…' : 'Create account'}
                </button>
                {!canCreate && (
                  <p className="text-center text-[14px] font-normal leading-[17px] text-[#6E6168]">
                    Agree to both required statements to create your account.
                  </p>
                )}
                {submitError && (
                  <p role="alert" className="text-center text-[14px] leading-[17px] text-red-600">
                    {submitError}
                  </p>
                )}
              </>
            )}
          </div>
        </form>
      </SignupCard>
    </SignupLayout>
  );
};

export default SignUpPage;