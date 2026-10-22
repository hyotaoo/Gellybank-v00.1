import { useEffect, useState } from 'react';
import CreateAccountButton from '@/components/auth/CreateAccountButton';
import LoginForm from '@/components/auth/LoginForm';

const TYPE_SPEED = 90;
const HOLD_DURATION = 3000;
const WHITE_TEXT = 'Welcome to Gelly';
const ACCENT_TEXT = 'Bank!';
const FULL_TEXT = `${WHITE_TEXT}${ACCENT_TEXT}`;

const useTypingEffect = (text: string, speed: number, hold: number) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(text.length);
      return;
    }

    if (count === text.length) {
      const timer = window.setTimeout(() => setCount(0), hold);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setCount((current) => current + 1), speed);
    return () => window.clearTimeout(timer);
  }, [count, text, speed, hold]);

  return count;
};

const BrandPanel = () => {
  const count = useTypingEffect(FULL_TEXT, TYPE_SPEED, HOLD_DURATION);
  const whiteVisible = WHITE_TEXT.slice(0, count);
  const accentVisible = ACCENT_TEXT.slice(0, Math.max(0, count - WHITE_TEXT.length));

  return (
    <section className="relative z-10 flex h-full w-full flex-col justify-center gap-6 px-5 py-6 sm:px-10 lg:w-[686px] lg:px-[72px] lg:py-10">
      <h1 className="relative max-w-[590px] text-[52px] font-black leading-none text-white sm:text-[64px] lg:text-[72px] 2xl:text-[96px]">
        <span aria-hidden="true" className="invisible">
          {WHITE_TEXT}
          <span className="text-brand-accent">{ACCENT_TEXT}</span>
        </span>
        <span aria-hidden="true" className="absolute inset-0">
          {whiteVisible}
          <span className="text-brand-accent">{accentVisible}</span>
          <span className="ml-1 inline-block h-[0.82em] w-[0.06em] translate-y-[0.08em] bg-brand-accent align-baseline animate-caret" />
        </span>
        <span className="sr-only">{FULL_TEXT}</span>
      </h1>

      <p className="text-[18px] font-normal leading-[1.21] text-ink lg:text-[20px]">
        Banking doesn’t have to be stressful.
      </p>

      <div className="flex w-full max-w-[513px] flex-col gap-4">
        <CreateAccountButton />
        <p className="text-center text-[14px] font-medium leading-[1.21] text-ink">
          Already have an account?
        </p>
        <LoginForm />
      </div>

      <span className="pointer-events-none absolute bottom-[-140px] left-[-80px] h-[260px] w-[260px] rounded-full bg-white/10" />
    </section>
  );
};

export default BrandPanel;
