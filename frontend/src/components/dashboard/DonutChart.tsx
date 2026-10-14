const segments = [
  { label: 'Essential (40%)', color: '#D987A3', value: 40 },
  { label: 'Dining (30%)', color: '#9C9496', value: 30 },
  { label: 'Travel (30%)', color: '#F8E7B9', value: 30 },
];

const gradient = (() => {
  let start = 0;
  return `conic-gradient(${segments
    .map(({ color, value }) => {
      const end = start + value;
      const stop = `${color} ${start}% ${end}%`;
      start = end;
      return stop;
    })
    .join(', ')})`;
})();

const DonutChart = () => (
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

export default DonutChart;
