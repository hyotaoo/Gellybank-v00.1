import Button from '@/components/common/Button';
import ArrowRightIcon from '@/components/icons/ArrowRightIcon';

const CreateAccountButton = () => (
  <Button
    type="button"
    variant="secondary"
    className="h-[78px] w-full justify-start gap-4 px-4"
  >
    <span className="text-[22px] font-bold leading-[1.21] sm:text-[26px] lg:text-[30px]">
      Create an Account
    </span>
    <ArrowRightIcon className="h-[38.5px] w-[42.5px] shrink-0 text-primary" />
  </Button>
);

export default CreateAccountButton;
