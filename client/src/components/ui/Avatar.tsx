import React from 'react';
import { classNames } from '../../utils/format';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline = false,
  className
}) => {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  };

  const ringSizes = {
    xs: 'ring-1',
    sm: 'ring-2',
    md: 'ring-2',
    lg: 'ring-2',
    xl: 'ring-2'
  };

  const getInitials = (userName: string) => {
    if (!userName) return '??';
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={classNames(
          'flex items-center justify-center rounded-full overflow-hidden bg-[#1F1F1F] text-white border border-[rgba(255,255,255,0.08)] font-semibold select-none',
          sizes[size],
          isOnline && `ring-offset-2 ring-offset-[#0A0A0A] ring-[#00E676] ${ringSizes[size]}`,
          className
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image, fallback to initials
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      
      {isOnline && (
        <span
          className={classNames(
            'absolute bottom-0 right-0 block rounded-full bg-[#00E676] ring-1 ring-[#0A0A0A]',
            size === 'xs' && 'w-1.5 h-1.5',
            size === 'sm' && 'w-2 h-2',
            size === 'md' && 'w-2.5 h-2.5',
            size === 'lg' && 'w-3 h-3',
            size === 'xl' && 'w-4 h-4'
          )}
        />
      )}
    </div>
  );
};
