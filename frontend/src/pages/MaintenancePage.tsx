import { BrandName, useBankSettings } from '@/context/BankSettingsContext';

const MaintenancePage = () => {
  const { settings } = useBankSettings();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#FFFCF7] px-6 text-center font-sans text-ink">
      <h1 className="text-[32px] font-bold leading-none">
        <BrandName />
      </h1>
      <section className="mt-8 w-full max-w-md rounded-[24px] border border-surface-line bg-white p-8 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.15)]">
        <h2 className="text-xl font-semibold">System under maintenance</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          {settings.bankName} is currently under maintenance. Please try again later.
        </p>
      </section>
    </main>
  );
};

export default MaintenancePage;
