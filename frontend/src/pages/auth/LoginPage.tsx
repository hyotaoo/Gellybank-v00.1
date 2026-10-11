import BrandPanel from '@/components/auth/BrandPanel';
import LoginIllustration from '@/components/auth/LoginIllustration';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';

const LoginPage = () => {
  const scale = useFitScale();

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
        <BrandPanel />
        <LoginIllustration />
      </div>
    </div>
  );
};

export default LoginPage;