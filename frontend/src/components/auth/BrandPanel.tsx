import CreateAccountButton from '@/components/auth/CreateAccountButton';
import LoginForm from '@/components/auth/LoginForm';

const BrandPanel = () => (
  <section className="relative z-10 flex w-full flex-col gap-10 px-6 pb-[72px] pt-16 lg:w-[686px] lg:flex-none lg:pl-[72px] lg:pr-6 lg:pt-[120px]">
    <h1 className="max-w-[590px] text-[56px] font-black leading-none text-white sm:text-[72px] lg:text-[96px]">
      Welcome to Gelly<span className="text-brand-accent">Bank!</span>
    </h1>

    <p className="text-[16px] font-normal leading-[1.21] text-ink sm:text-[20px]">
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

export default BrandPanel;
