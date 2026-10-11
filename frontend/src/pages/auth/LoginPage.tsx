import BrandPanel from '@/components/auth/BrandPanel';
import LoginIllustration from '@/components/auth/LoginIllustration';
import rightBg from '@/assets/gelly-right-bg.png';

const LoginPage = () => (
  <div className="flex min-h-screen w-full justify-center bg-brand-gradient font-sans text-ink">
    <div className="relative flex min-h-screen w-full max-w-[1440px] flex-col overflow-hidden bg-brand-gradient lg:h-screen lg:flex-row">
      <BrandPanel />
      <LoginIllustration />

      <img
        src={rightBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-[1369px] top-0 hidden h-[683px] w-[683px] max-w-none object-cover lg:block"
      />
    </div>
  </div>
);

export default LoginPage;
