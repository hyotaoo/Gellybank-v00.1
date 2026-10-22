import type { CSSProperties } from 'react';
import gellyObject from '@/assets/gelly-object.png';
import coin from '@/assets/coin.png';

const FALLING_COINS = [
  { key: 0, size: 40, dx: -12, start: -360, dur: 3.4, delay: 0, opacity: 0.9, turns: '360deg' },
  { key: 1, size: 44, dx: 8, start: -320, dur: 3.0, delay: 0.55, opacity: 1, turns: '720deg' },
  { key: 2, size: 36, dx: 16, start: -400, dur: 3.8, delay: 1.1, opacity: 0.85, turns: '360deg' },
  { key: 3, size: 42, dx: -8, start: -300, dur: 3.2, delay: 1.65, opacity: 0.95, turns: '540deg' },
  { key: 4, size: 38, dx: 4, start: -380, dur: 3.6, delay: 2.2, opacity: 0.9, turns: '360deg' },
  { key: 5, size: 46, dx: -14, start: -420, dur: 3.4, delay: 2.75, opacity: 1, turns: '720deg' },
] as const;

const LoginIllustration = () => (
  <section className="absolute inset-y-0 right-0 hidden w-[754px] overflow-hidden lg:block">
    <div className="absolute bottom-[-34px] left-[90px] h-[460px] w-[446px] xl:bottom-[-12px] xl:left-[67px] xl:h-[507px] xl:w-[491px]">
      <img
        src={gellyObject}
        alt="GellyBank login illustration"
        className="h-full w-full max-w-none"
      />

      {FALLING_COINS.map((c) => (
        <img
          key={`coin-fall-${c.key}`}
          src={coin}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-[8%] max-w-none animate-coin-fall"
          style={
            {
              width: `${c.size}px`,
              height: `${c.size}px`,
              left: `calc(50% - ${c.size / 2}px)`,
              animationDelay: `${c.delay}s`,
              '--coin-x': `${c.dx}px`,
              '--coin-start': `${c.start}px`,
              '--coin-opacity': c.opacity,
              '--coin-turns': c.turns,
              '--coin-dur': `${c.dur}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>

    <span className="pointer-events-none absolute right-[-89px] top-[-95px] h-[390px] w-[427px] rounded-full bg-white/10" />
  </section>
);

export default LoginIllustration;
