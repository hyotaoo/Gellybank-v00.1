import ProfileIcon from '@/components/icons/ProfileIcon';

interface CustomerAvatarProps {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
  className?: string;
}

const initial = (value?: string | null): string =>
  value?.trim().charAt(0).toUpperCase() ?? '';

const CustomerAvatar = ({
  firstName,
  middleName,
  lastName,
  avatar,
  className = '',
}: CustomerAvatarProps) => {
  const initials = `${initial(firstName)}${initial(lastName)}` || initial(middleName);
  const name = [firstName, middleName, lastName].filter(Boolean).join(' ') || 'Customer';

  return (
    <span
      role="img"
      aria-label={`${name} avatar`}
      className={`inline-flex flex-none items-center justify-center overflow-hidden rounded-full border border-surface-input bg-surface-card font-semibold leading-none text-primary ${className}`}
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || <ProfileIcon aria-hidden="true" className="h-1/2 w-1/2" />
      )}
    </span>
  );
};

export default CustomerAvatar;
