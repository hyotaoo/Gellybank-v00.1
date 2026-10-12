import DashboardLayout from '@/components/dashboard/DashboardLayout';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

const PlaceholderPage = ({ title, description }: PlaceholderPageProps) => (
  <DashboardLayout title={title}>
    <div className="flex flex-1 items-center justify-center rounded-[36px] border border-surface-line bg-surface-soft p-10 text-center">
      <div className="flex max-w-[420px] flex-col gap-2">
        <h2 className="text-[24px] font-semibold leading-[1.21] text-ink">{title}</h2>
        <p className="text-[14px] leading-[1.21] text-muted">{description}</p>
      </div>
    </div>
  </DashboardLayout>
);

export default PlaceholderPage;
