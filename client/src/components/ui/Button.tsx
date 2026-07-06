import React, { ButtonHTMLAttributes } from 'react';
import { classNames } from '../../utils/format';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-[#00E676] text-black hover:bg-[#00C853] focus:ring-2 focus:ring-[#00E676] focus:ring-offset-2 focus:ring-offset-[#0A0A0A]',
    ghost: 'border border-[rgba(0,230,118,0.3)] text-[#00E676] hover:bg-[#1B4332] focus:ring-2 focus:ring-[#00E676]',
    secondary: 'bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] text-white hover:bg-[#252525] focus:ring-2 focus:ring-white/20',
    danger: 'bg-[#FF3D3D] text-white hover:bg-[#E53535] focus:ring-2 focus:ring-[#FF3D3D]'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  };

  return (
    <button
      className={classNames(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
