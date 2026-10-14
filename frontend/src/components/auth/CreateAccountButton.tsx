import { Link } from 'react-router-dom';
import ArrowRightIcon from '@/components/icons/ArrowRightIcon';

const CreateAccountButton = () => (
  <Link
    to="/signup"
    className="relative inline-flex h-[78px] w-full items-center justify-center rounded-[36px] border border-transparent bg-surface-card px-4 text-ink transition-colors hover:border-primary hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
  >
    <span className="text-[30px] font-bold leading-[1.21]">Create an Account</span>
    <ArrowRightIcon className="absolute right-4 h-[38.5px] w-[42.5px] shrink-0 text-primary" />
  </Link>
);

export default CreateAccountButton;
