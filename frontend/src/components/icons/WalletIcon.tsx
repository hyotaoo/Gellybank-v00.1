import type { SVGProps } from 'react';

const WalletIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M15.5 12.5h2.5" />
    <path d="M3 9.5h13a2.5 2.5 0 0 1 0 5H3" />
  </svg>
);

export default WalletIcon;
