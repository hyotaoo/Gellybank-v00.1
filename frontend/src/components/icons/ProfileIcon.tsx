import type { SVGProps } from 'react';

const ProfileIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20c.6-3.2 3.8-5.5 7.5-5.5s6.9 2.3 7.5 5.5" />
  </svg>
);

export default ProfileIcon;
