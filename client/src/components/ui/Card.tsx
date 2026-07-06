import React, { HTMLAttributes } from 'react';
import { classNames } from '../../utils/format';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  active = false,
  hoverable = true,
  className,
  ...props
}) => {
  return (
    <div
      className={classNames(
        'bg-[#161616] border rounded-xl p-5 transition-all duration-150 ease-in-out',
        active 
          ? 'border-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.15)]' 
          : 'border-[rgba(255,255,255,0.08)]',
        hoverable && 'hover:border-[rgba(0,230,118,0.4)] hover:shadow-[0_0_10px_rgba(0,230,118,0.1)] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
