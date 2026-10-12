import type { SVGProps } from 'react';

const TransferIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M21.5 2.5 2.5 9.8l6.2 2.6 2.6 6.2 10.2-16.1Z" />
    <path d="M8.7 12.4 21.5 2.5" />
  </svg>
);

export default TransferIcon;
