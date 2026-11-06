import type { SVGProps } from 'react';

const BankIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="m3 9 9-5 9 5" />
    <path d="M5 9v8" />
    <path d="M9 9v8" />
    <path d="M15 9v8" />
    <path d="M19 9v8" />
    <path d="M3 21h18" />
  </svg>
);

export default BankIcon;