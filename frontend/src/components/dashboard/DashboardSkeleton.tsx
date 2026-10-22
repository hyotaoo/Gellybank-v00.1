const SkeletonBlock = ({ className }: { className: string }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-full bg-surface-line ${className}`} />
);

const DashboardSkeleton = () => (
  <section role="status" aria-label="Loading dashboard" className="flex flex-col gap-6">
    <div className="flex gap-3">
      <SkeletonBlock className="h-12 w-40" />
      <SkeletonBlock className="h-12 w-32" />
    </div>

    <div className="h-[320px] rounded-[36px] bg-brand-gradient p-8 sm:p-10">
      <SkeletonBlock className="h-5 w-40 bg-white/25" />
      <SkeletonBlock className="mt-8 h-14 w-56 bg-white/25" />
      <div className="mt-auto flex gap-3 pt-20">
        <SkeletonBlock className="h-16 w-28 bg-white/25" />
        <SkeletonBlock className="h-16 w-28 bg-white/25" />
        <SkeletonBlock className="h-16 w-28 bg-white/25" />
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[0, 1].map((index) => (
        <div key={index} className="h-[360px] rounded-[36px] border border-surface-line bg-surface-soft p-6 sm:p-8">
          <SkeletonBlock className="h-5 w-40" />
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3].map((row) => (
              <SkeletonBlock key={row} className="h-14 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default DashboardSkeleton;
