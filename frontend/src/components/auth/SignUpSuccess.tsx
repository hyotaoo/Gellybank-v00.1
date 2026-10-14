import Button from '@/components/common/Button';
import CircleCheckIcon from '@/components/icons/CircleCheckIcon';

interface SignUpSuccessProps {
  onContinue: () => void;
}

const SignUpSuccess = ({ onContinue }: SignUpSuccessProps) => (
  <div className="flex flex-col items-center gap-4 py-6 text-center">
    <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface-card text-primary">
      <CircleCheckIcon className="h-9 w-9" />
    </span>
    <h1 className="text-[24px] font-bold leading-[1.21] text-ink">Account created!</h1>
    <p className="max-w-[360px] text-[14px] leading-[1.21] text-muted">
      Your GellyBank account is verified and ready. Sign in to view your dashboard and make your
      first deposit.
    </p>
    <Button
      type="button"
      variant="primary"
      onClick={onContinue}
      className="mt-2 h-[56px] w-full justify-center text-[17px] font-semibold"
    >
      Go to sign in
    </Button>
  </div>
);

export default SignUpSuccess;
