import type { SVGProps } from 'react';

const CreditCardIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M2.5 9.5h19" />
    <path d="M6 14.5h4" />
  </svg>
);

export default CreditCardIcon;
