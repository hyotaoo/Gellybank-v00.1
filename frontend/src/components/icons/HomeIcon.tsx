import type { SVGProps } from 'react';

const HomeIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.6V20a1 1 0 0 0 1 1h3.4v-4.6a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1V21H18a1 1 0 0 0 1-1V9.6" />
  </svg>
);

export default HomeIcon;
