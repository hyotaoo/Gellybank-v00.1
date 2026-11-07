import { Link } from 'react-router-dom';
import ArrowRightIcon from '@/components/icons/ArrowRightIcon';

// Figma 2054:1661 — 477x81, r37, cream fill, 5px #F8DB83 ring
const CreateAccountButton = () => (
  <Link
    to="/signup"
    className="relative mx-auto flex h-[81px] w-[477px] items-center justify-between rounded-[37px] border-[5px] border-[#F8DB83] bg-cream px-[17px] transition-colors hover:border-[#E9C96B] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
  >
    <span className="pl-[38px] text-[36px] font-medium leading-[43px] text-[#331B29]/75">
      Create an Account
    </span>
    <ArrowRightIcon className="h-10 w-11 shrink-0 text-[#F8DB83]" />
  </Link>
);

export default CreateAccountButton;