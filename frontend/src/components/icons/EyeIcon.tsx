import type { SVGProps } from 'react';

const EyeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M1.833 11S4.996 4.583 11 4.583 20.167 11 20.167 11 17.004 17.417 11 17.417 1.833 11 1.833 11Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="11" cy="11" r="3.2" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export default EyeIcon;
