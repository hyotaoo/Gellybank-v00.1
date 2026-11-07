import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '@/api/auth';
import { ApiError } from '@/api/client';
import OtpForm from '@/components/auth/OtpForm';
import SignupLayout from '@/components/auth/SignupLayout';
import SignUpForm from '@/components/auth/SignUpForm';
import type { SignUpDetails } from '@/components/auth/SignUpForm';
import SignUpSuccess from '@/components/auth/SignUpSuccess';

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
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SignupLayout>
      <div className="w-[631px] rounded-[36px] border border-primary bg-page/90 px-[54px] py-6">
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
          <SignUpSuccess onContinue={() => navigate('/login', { state: { registered: true } })} />
        )}
      </div>
    </SignupLayout>
  );
};

export default SignUpPage;
