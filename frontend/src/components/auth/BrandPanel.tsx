import CreateAccountButton from '@/components/auth/CreateAccountButton';
import LoginForm from '@/components/auth/LoginForm';

const BrandPanel = () => (
  <section className="relative z-10 flex w-[686px] flex-none flex-col gap-10 pb-[72px] pl-[72px] pr-6 pt-[120px]">
    <h1 className="max-w-[590px] text-[96px] font-black leading-none text-white">
      Welcome to Gelly<span className="text-brand-accent">Bank!</span>
    </h1>

    <p className="text-[20px] font-normal leading-[1.21] text-ink">
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
