import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '@/api/auth';
import { ApiError } from '@/api/client';
import brandDecorationCircle from '@/assets/teller/brand-decoration-circle-large.svg';
import OtpForm from '@/components/auth/OtpForm';
import SignUpForm from '@/components/auth/SignUpForm';
import ScrollArea from '@/components/common/ScrollArea';
import type { SignUpDetails } from '@/components/auth/SignUpForm';
import SignUpSuccess from '@/components/auth/SignUpSuccess';
import { clearSignUpDraft } from '@/utils/signupDraft';

type Step = 'details' | 'otp' | 'success';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const handleDetails = async (details: SignUpDetails) => {
    setDestination(details.email);
    setError(undefined);
    setSubmitting(true);
    try {
      await register(details);
      clearSignUpDraft();
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] w-full overflow-x-hidden bg-brand-gradient font-sans text-ink">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col items-center justify-center gap-6 px-5 py-10 sm:px-10 lg:px-14">
        <img
          aria-hidden="true"
          src={brandDecorationCircle}
          className="pointer-events-none absolute -right-[69px] -top-[52px]"
          width="427"
          height="390"
          alt=""
        />

        {/* Card, centered */}
        <section className="relative z-10 flex w-full max-w-[720px] flex-col items-center gap-4">
          <ScrollArea
            className="flex w-full flex-col rounded-[36px] bg-surface-card px-6 py-8 sm:px-[54px] sm:py-[35px] md:max-h-[min(780px,calc(100dvh_-_140px))]"
            railClassName="right-[23px]"
          >
            <div className={step === 'details' ? 'contents' : 'hidden'}>
              <SignUpForm onSubmit={handleDetails} error={error} submitting={submitting} />
            </div>

            {step === 'otp' && (
              <OtpForm
                email={destination}
                onVerified={() => setStep('success')}
                onBack={() => setStep('details')}
              />
            )}

            {step === 'success' && (
              <SignUpSuccess
                onContinue={() => navigate('/login', { state: { registered: true } })}
              />
            )}
          </ScrollArea>

          <p className="w-full text-center text-[14px] font-medium leading-[1.21] text-ink">
            Already have an account?{' '}
            <Link to="/login" onClick={() => clearSignUpDraft()} className="font-semibold text-white underline">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
};

export default SignUpPage;
