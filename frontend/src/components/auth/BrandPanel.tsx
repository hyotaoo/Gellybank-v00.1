import CreateAccountButton from '@/components/auth/CreateAccountButton';
import LoginForm from '@/components/auth/LoginForm';

// Figma 17:4 — 801x997 at x100, pad 120/24/72/72, gap 25
const BrandPanel = () => (
  <section className="relative z-10 flex h-[997px] w-[801px] flex-none flex-col gap-[25px] pb-[72px] pl-[72px] pr-6 pt-[120px]">
    <h1 className="whitespace-pre-line text-[64px] font-bold leading-[77px] text-ink">
      {'Welcome to\nGellyBank'}
    </h1>

    <p className="text-[20px] font-normal leading-[24px] text-ink">
      Bank that is flexible, not fragile.
    </p>

    <div className="mt-[24px] flex w-[513px] flex-col gap-4">
      <CreateAccountButton />
      <p className="text-center text-[16px] font-normal leading-[19px] text-ink">
        Already have an account?
      </p>
      <LoginForm />
    </div>

    <span className="pointer-events-none absolute left-[-80px] top-[877px] h-[260px] w-[260px] rounded-full bg-white/[0.12]" />
  </section>
);

export default BrandPanel;