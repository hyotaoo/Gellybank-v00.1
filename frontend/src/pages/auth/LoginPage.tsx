import { Link } from 'react-router-dom';
import logoMain from '@/assets/logo-main.png';
import CreateAccountButton from '@/components/auth/CreateAccountButton';
import useFitScale, { DESIGN_HEIGHT, DESIGN_WIDTH } from '@/hooks/useFitScale';

const OUTER_BG = 'linear-gradient(to bottom right, #E79AB4 0%, #DC8FA9 50%, #E6B0C2 100%)';
const INNER_BG = 'radial-gradient(circle 720px at 50% 50%, #FFF2CA 0%, #FCE8EE 100%)';

// Figma 2054:1631 — Desktop - Welcome-Main, 1440x1024
const LoginPage = () => {
  const scale = useFitScale();

  return (
    <div
      className="flex h-[100dvh] w-full items-center justify-center overflow-hidden font-sans text-ink"
      style={{ background: OUTER_BG }}
    >
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
          background: OUTER_BG,
        }}
      >
        {/* The image layer is 1440x1440 and extends below the 1024 frame, clipping naturally. */}
        <div
          className="pointer-events-none absolute left-0 top-0 h-[1440px] w-[1440px]"
          style={{ background: INNER_BG }}
        />

        <img
          src={logoMain}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="pointer-events-none absolute left-[252px] top-[502px] h-[936px] w-[936px] max-w-none object-contain"
        />

        <h1 className="absolute left-[392px] top-[180px] w-[657px] whitespace-nowrap text-center text-[64px] leading-[76.8px]">
          <span className="font-normal text-[#331B29]">Welcome to </span>
          <span className="font-bold text-rose-300">GellyBank</span>
        </h1>

        <div className="absolute left-[463px] top-[356px] w-[513px]">
          <CreateAccountButton />
        </div>

        <Link
          to="/signin"
          className="group absolute left-[463px] top-[444px] block w-[513px] text-center text-[16px] font-light leading-[19.2px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BD597F] focus-visible:ring-offset-2"
        >
          Already have an account?{' '}
          <span className="text-[#BD597F] group-hover:underline">Sign In</span>
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
