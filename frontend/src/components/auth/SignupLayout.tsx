import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import LoginIllustration from '@/components/auth/LoginIllustration';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';

const PAGE_BG = 'bg-[radial-gradient(circle_at_80%_72%,#FFF2CA_0%,#FCE8EE_100%)]';

interface SignupLayoutProps {
  children: ReactNode;
}

// Figma 2196:546 / 2202:507 — 801 brand column, 594 illustration, card at y67
const SignupLayout = ({ children }: SignupLayoutProps) => {
  const scale = useFitScale();

  return (
    <div
      className={`flex h-[100dvh] w-full items-center justify-center overflow-hidden font-sans text-ink ${PAGE_BG}`}
    >
      <div
        className={`relative shrink-0 overflow-hidden ${PAGE_BG}`}
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <section className="absolute left-0 top-0 h-[1008px] w-[801px]">
          <span className="pointer-events-none absolute left-[-80px] top-[888px] h-[260px] w-[260px] rounded-full bg-white/[0.12]" />

          <div className="absolute left-[50px] top-[32px] flex max-h-[976px] w-[751px] flex-col gap-4 overflow-y-auto pb-4 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/60 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.12] [&::-webkit-scrollbar]:w-1.5">
            <Link
              to="/signin"
              className="text-center text-[16px] font-normal leading-[19px] text-ink hover:underline"
            >
              Already have an account?
            </Link>
            <div className="flex justify-center">{children}</div>
          </div>
        </section>

        {/* The GIF has transparent top padding, so lift it to center its visible artwork. */}
        <LoginIllustration left={825} top={-85} />
      </div>
    </div>
  );
};

export default SignupLayout;