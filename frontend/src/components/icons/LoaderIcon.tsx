import type { SVGProps } from 'react';

const LoaderIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M12 3a9 9 0 1 0 9 9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export default LoaderIcon;