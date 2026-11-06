import BrandPanel from '@/components/auth/BrandPanel';
import LoginIllustration from '@/components/auth/LoginIllustration';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';

// Figma 14:39 — 1440x1024, radial cream→blush page fill
const SignInPage = () => {
  const scale = useFitScale();

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_80%_72%,#FFF2CA_0%,#FCE8EE_100%)] font-sans text-ink">
      <div
        className="relative shrink-0 overflow-hidden bg-[radial-gradient(circle_at_80%_72%,#FFF2CA_0%,#FCE8EE_100%)]"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <BrandPanel />
        <LoginIllustration />
      </div>
    </div>
  );
};

export default SignInPage;
