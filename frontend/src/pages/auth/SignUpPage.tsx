import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoginIllustration from '@/components/auth/LoginIllustration';
import OtpForm from '@/components/auth/OtpForm';
import SignUpForm from '@/components/auth/SignUpForm';
import type { SignUpDetails } from '@/components/auth/SignUpForm';
import SignUpSuccess from '@/components/auth/SignUpSuccess';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';

type Step = 'details' | 'otp' | 'success';

const SignUpPage = () => {
  const scale = useFitScale();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');
  const [destination, setDestination] = useState('');

  const handleDetails = (details: SignUpDetails) => {
    setDestination(details.email);
    setStep('otp');
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
