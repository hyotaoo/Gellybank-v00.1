import { Link } from 'react-router-dom';
import brandDecorationCircle from '@/assets/teller/brand-decoration-circle-large.svg';
import coin from '@/assets/login/coin.png';
import createAccountPath from '@/assets/login/create-account-path.svg';
import object from '@/assets/login/object.png';
import vector1 from '@/assets/login/vector-1.svg';
import vector2 from '@/assets/login/vector-2.svg';
import vector3 from '@/assets/login/vector-3.svg';
import vector4 from '@/assets/login/vector-4.svg';

const LoginPage = () => (
  <main className="h-[100dvh] w-full overflow-hidden bg-brand-gradient font-sans text-ink">
    <section className="relative hidden h-full overflow-hidden lg:block" aria-label="Welcome to GellyBank">
      {/* Canvas is 1440px wide, so left = 50% - 720px keeps it centered in the viewport */}
      <div className="absolute -top-24 left-[calc(50%-720px)] h-[1024px] w-[1440px] bg-brand-gradient">
        <img src={brandDecorationCircle} className="pointer-events-none absolute -right-[69px] -top-[52px]" width="427" height="390" alt="" />
        <img src={brandDecorationCircle} className="pointer-events-none absolute -bottom-[195px] -left-[65px]" width="427" height="390" alt="" />

        <h1 className="absolute left-[719px] top-[207px] w-[1244px] -translate-x-1/2 text-center text-[96px] font-black leading-none text-white">
          Welcome to Gelly<span className="text-brand-accent">Bank!</span>
        </h1>

        <div className="absolute left-[462px] top-[369px] flex w-[513px] flex-col items-center gap-4">
          <Link to="/signup" className="flex h-[78px] w-full items-center justify-center gap-4 rounded-[36px] bg-surface-card px-4 text-[30px] font-bold leading-none text-ink transition-colors hover:bg-[#f6c2d5] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2">
            <span>Create an Account</span>
            <img src={createAccountPath} width="42.54" height="38.54" alt="" />
          </Link>
          <p className="text-center text-[16px] font-medium leading-none text-ink">
            Already have an account? <Link to="/login" className="text-primary-hover hover:underline">Sign In</Link>
          </p>
        </div>

        <img src={object} className="pointer-events-none absolute left-[320px] top-[528px] h-[847px] w-[820px] object-cover" alt="" />
        <img src={coin} className="pointer-events-none absolute left-[678px] top-[528px] h-[82px] w-[82px] object-cover" alt="" />
        <div className="pointer-events-none absolute left-[739.98px] top-[566.49px] h-[24.552px] w-[6.134px]"><img src={vector1} alt="" /></div>
        <div className="pointer-events-none absolute left-[740.47px] top-[564.28px] h-[29.778px] w-[7.649px]"><img src={vector2} alt="" /></div>
        <div className="pointer-events-none absolute left-[738.42px] top-[567.06px] h-[28.069px] w-[7.661px]"><img src={vector3} alt="" /></div>
        <div className="pointer-events-none absolute left-[736.77px] top-[547.21px] h-[8.056px] w-[5.788px]"><img src={vector4} alt="" /></div>
      </div>
    </section>

    <section className="relative flex h-full flex-col items-center justify-center gap-5 px-6 text-center lg:hidden">
      <img src={brandDecorationCircle} className="pointer-events-none absolute -right-[230px] -top-[180px]" width="427" height="390" alt="" />
      <h1 className="relative text-[52px] font-black leading-none text-white sm:text-[64px]">
        Welcome to Gelly<span className="text-brand-accent">Bank!</span>
      </h1>
      <div className="relative flex w-full max-w-[513px] flex-col gap-4">
        <Link to="/signup" className="flex h-[78px] w-full items-center justify-center gap-4 rounded-[36px] bg-surface-card px-4 text-[24px] font-bold leading-none text-ink">
          <span>Create an Account</span>
          <img src={createAccountPath} width="42.54" height="38.54" alt="" />
        </Link>
        <p className="text-[16px] font-medium leading-none">Already have an account? <Link to="/login" className="text-primary-hover">Sign In</Link></p>
      </div>
      <img src={object} className="pointer-events-none absolute -bottom-40 left-1/2 w-[440px] -translate-x-1/2 opacity-90" alt="" />
    </section>
  </main>
);

export default LoginPage;