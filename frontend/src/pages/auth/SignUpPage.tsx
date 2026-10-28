import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoginIllustration from '@/components/auth/LoginIllustration';
import OtpForm from '@/components/auth/OtpForm';
import SignUpForm from '@/components/auth/SignUpForm';
import type { SignUpDetails } from '@/components/auth/SignUpForm';
import SignUpSuccess from '@/components/auth/SignUpSuccess';

type Step = 'details' | 'otp' | 'success';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');
  const [destination, setDestination] = useState('');

  const handleDetails = (details: SignUpDetails) => {
    setDestination(details.email);
    setStep('otp');
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-brand-gradient font-sans text-ink">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1440px] overflow-hidden">
        <section className="relative z-10 flex w-full flex-col gap-4 px-5 py-10 sm:px-10 md:w-[686px] md:px-[72px] md:pb-[72px] md:pt-[120px]">
          <div className="flex w-full max-w-[513px] flex-col rounded-[36px] bg-surface-card px-6 py-8 sm:px-[54px] sm:py-[35px] md:max-h-[780px] md:overflow-y-auto">
            <div className={step === 'details' ? 'contents' : 'hidden'}>
              <SignUpForm onSubmit={handleDetails} />
            </div>

            {step === 'otp' && (
              <OtpForm
                destination={destination}
                onVerified={() => setStep('success')}
                onBack={() => setStep('details')}
              />
            )}

            {step === 'success' && (
              <SignUpSuccess
                onContinue={() => navigate('/login', { state: { registered: true } })}
              />
            )}
          </div>

          <p className="w-full max-w-[513px] text-center text-[14px] font-medium leading-[1.21] text-ink">
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
