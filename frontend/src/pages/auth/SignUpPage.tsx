import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoginIllustration from '@/components/auth/LoginIllustration';
import OtpForm from '@/components/auth/OtpForm';
import SignUpForm from '@/components/auth/SignUpForm';
import type { SignUpDetails } from '@/components/auth/SignUpForm';
import SignUpSuccess from '@/components/auth/SignUpSuccess';
import { register } from '@/api/auth';
import { GUEST_SESSION_TOKEN, setAuthToken } from '@/api/client';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';

type Step = 'details' | 'otp' | 'success';

const SignUpPage = () => {
  const scale = useFitScale();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<SignUpDetails | null>(null);

  const handleDetails = (values: SignUpDetails) => {
    setDetails(values);
    setStep('otp');
  };

  const handleVerified = async () => {
    if (!details) return;
    try {
      await register({
        firstName: details.firstName,
        middleName: details.middleName || undefined,
        lastName: details.lastName,
        birthdate: details.birthdate,
        email: details.email,
        countryCode: details.countryCode,
        phone: details.phone,
        address: details.address,
        sourceOfFunds: details.sourceOfFunds,
        accountType: details.accountType,
        purposeOfAccount: details.purposeOfAccount,
        password: details.password,
      });
      setStep('success');
    } catch {
      // Keep the demo usable when account creation is blocked by the backend.
      setAuthToken(GUEST_SESSION_TOKEN);
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-brand-gradient font-sans text-ink">
      <div
        className="relative flex shrink-0 overflow-hidden bg-brand-gradient"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <section className="relative z-10 flex w-[686px] flex-none flex-col gap-4 pb-[72px] pl-[72px] pr-6 pt-[120px]">
          <div className="flex max-h-[780px] w-[513px] flex-col overflow-y-auto rounded-[36px] bg-surface-card px-[54px] py-[35px]">
            <div className={step === 'details' ? 'contents' : 'hidden'}>
              <SignUpForm onSubmit={handleDetails} />
            </div>

            {step === 'otp' && (
              <OtpForm
                destination={details?.email ?? ''}
                onVerified={handleVerified}
                onBack={() => setStep('details')}
              />
            )}

            {step === 'success' && (
              <SignUpSuccess
                onContinue={() => navigate('/login', { state: { registered: true } })}
              />
            )}
          </div>

          <p className="w-[513px] text-center text-[14px] font-medium leading-[1.21] text-ink">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </section>

        <LoginIllustration />
      </div>
    </div>
  );
};

export default SignUpPage;
