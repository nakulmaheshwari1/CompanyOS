import React, { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { classNames } from '../../utils/format';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full mb-4">
        {label && (
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={classNames(
            'w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#00E676] transition-all duration-150 text-sm',
            error && 'border-status-danger focus:border-status-danger',
            className
          )}
          {...props}
        />
        {error && <span className="block text-xs text-status-danger mt-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full mb-4">
        {label && (
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={classNames(
            'w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#00E676] transition-all duration-150 text-sm min-h-[100px] resize-y',
            error && 'border-status-danger focus:border-status-danger',
            className
          )}
          {...props}
        />
        {error && <span className="block text-xs text-status-danger mt-1">{error}</span>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
