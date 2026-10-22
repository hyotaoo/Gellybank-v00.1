import LoginForm from '@/components/auth/LoginForm';
import LoginIllustration from '@/components/auth/LoginIllustration';

const SignInPage = () => (
  <main className="min-h-[100dvh] w-full overflow-hidden bg-brand-gradient font-sans text-ink">
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1440px] items-center px-5 py-10 sm:px-10 lg:px-0">
      <section className="relative z-10 flex w-full flex-col gap-5 lg:ml-[72px] lg:w-[620px]">
        <h1 className="text-center text-[52px] font-black leading-none text-white sm:text-[64px] lg:text-left">
          Welcome Back!
        </h1>
        <LoginForm />
      </section>
      <LoginIllustration />
    </div>
  </main>
);

export default SignInPage;
