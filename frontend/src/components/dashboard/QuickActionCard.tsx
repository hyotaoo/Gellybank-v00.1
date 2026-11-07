import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface QuickActionCardProps {
  icon: ReactNode;
  label: string;
  to: string;
}

// Figma 45:386 — 195x84, r20, p16, white 12%, icon bubble 40 on the right
const QuickActionCard = ({ icon, label, to }: QuickActionCardProps) => (
  <Link
    to={to}
    className="flex h-[84px] min-w-0 flex-1 flex-col justify-between rounded-[20px] border border-white/[0.18] bg-white/[0.12] px-4 py-[8.5px] text-center text-white transition-colors hover:bg-white/[0.2] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
  >
    <span className="flex justify-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.16]">
        {icon}
      </span>
    </span>
    <span className="w-full truncate text-[16px] font-semibold leading-[19px]">{label}</span>
  </Link>
);

export default QuickActionCard;
