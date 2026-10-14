import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface QuickActionCardProps {
  icon: ReactNode;
  label: string;
  to: string;
}

const QuickActionCard = ({ icon, label, to }: QuickActionCardProps) => (
  <Link
    to={to}
    className="flex h-[88px] flex-1 flex-col items-start justify-between rounded-[20px] bg-white/[0.12] p-[14px] text-left text-white transition-colors hover:bg-white/[0.2] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
  >
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.16]">
      {icon}
    </span>
    <span className="text-[16px] font-semibold leading-[1.21]">{label}</span>
  </Link>
);

export default QuickActionCard;
