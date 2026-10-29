import LoginForm from '@/components/auth/LoginForm';
import LoginIllustration from '@/components/auth/LoginIllustration';
import brandDecorationCircle from '@/assets/teller/brand-decoration-circle-large.svg';

const SignInPage = () => (
  <main className="min-h-[100dvh] w-full overflow-hidden bg-brand-gradient font-sans text-ink">
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col items-center justify-center gap-10 px-5 py-10 sm:px-10 lg:px-14">
      <img
        aria-hidden="true"
        src={brandDecorationCircle}
        className="pointer-events-none absolute -right-[69px] -top-[52px]"
        width="427"
        height="390"
        alt=""
      />

      {/* Heading + form, centered */}
      <section className="relative z-10 flex w-full max-w-[720px] flex-col items-center gap-12">
        <h1 className="text-center text-[52px] font-black leading-none text-white sm:text-[64px]">
          <span className="text-white/60">Welcome</span> Back!
        </h1>
        <LoginForm />
      </section>

      {/* Illustration, centered below the form */}
      <div className="relative z-10 flex w-full max-w-[480px] items-center justify-center">
        <LoginIllustration />
      </div>
    </div>
  </main>
);

export default SignInPage;