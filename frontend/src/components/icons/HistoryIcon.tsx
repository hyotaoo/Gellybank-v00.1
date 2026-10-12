import type { SVGProps } from 'react';

const HistoryIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M3 12a9 9 0 1 0 2.64-6.36" />
    <path d="M3 3v4.5h4.5" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export default HistoryIcon;
