import React from 'react';
import { classNames } from '../../utils/format';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className
}) => {
  const styles = {
    success: 'bg-[#1B4332] text-[#00E676] border border-[rgba(0,230,118,0.25)]',
    warning: 'bg-[#3A2D0F] text-[#FFB300] border border-[rgba(255,179,0,0.25)]',
    danger: 'bg-[#3D1414] text-[#FF3D3D] border border-[rgba(255,61,61,0.25)]',
    info: 'bg-[#132A3E] text-[#3D9EFF] border border-[rgba(61,158,255,0.25)]',
    neutral: 'bg-[#1F1F1F] text-[#A3A3A3] border border-[rgba(255,255,255,0.08)]'
  };

  return (
    <span
      className={classNames(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
