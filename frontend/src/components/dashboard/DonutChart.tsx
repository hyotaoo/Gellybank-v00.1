export interface DonutSegment {
  label: string;
  color: string;
  value: number;
}

interface DonutChartProps {
  segments: DonutSegment[];
  emptyLabel?: string;
}

const DonutChart = ({ segments, emptyLabel = 'No spending data yet.' }: DonutChartProps) => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (segments.length === 0 || total <= 0) {
    return <p className="text-[13px] leading-[1.21] text-muted">{emptyLabel}</p>;
  }

  let start = 0;
  const gradient = `conic-gradient(${segments
    .map(({ color, value }) => {
      const end = start + (value / total) * 100;
      const stop = `${color} ${start}% ${end}%`;
      start = end;
      return stop;
    })
    .join(', ')})`;

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex-none rounded-full"
        style={{ height: 100, width: 100, background: gradient }}
        role="img"
        aria-label="Spending habits breakdown"
      >
        <span className="absolute inset-[24px] rounded-full bg-white" />
      </div>

      <ul className="flex flex-col gap-2.5">
        {segments.map(({ label, color }) => (
          <li key={label} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[14px] leading-[1.21] text-ink">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DonutChart;
