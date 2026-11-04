import animatedLogo from '@/assets/animated-transparent.gif';

interface LoginIllustrationProps {
  left?: number;
  top?: number;
}

// Figma 45:107 / 2196:623 — 594x1024 illustration frame, portrait animation centered
const LoginIllustration = ({ left = 824, top = 0 }: LoginIllustrationProps) => (
  <section className="absolute top-0 h-[1024px] w-[594px]" style={{ left }}>
    <img
      src={animatedLogo}
      alt="GellyBank"
      decoding="async"
      className="absolute left-1/2 h-[1024px] w-auto max-w-none -translate-x-1/2 object-contain"
      style={{ top }}
    />
  </section>
);

export default LoginIllustration;