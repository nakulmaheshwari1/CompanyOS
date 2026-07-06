import React, { InputHTMLAttributes, TextareaHTMLAttributes, useState } from 'react';
import { classNames } from '../../utils/format';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full mb-4">
        {label && (
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={classNames(
              'w-full px-3.5 py-2.5 bg-[#1C1C1C] border border-[rgba(255,255,255,0.08)] rounded-lg text-white placeholder-[#525252] focus:outline-none focus:border-[#00E676] transition-all duration-150 text-sm',
              isPassword && 'pr-10',
              error && 'border-status-danger focus:border-status-danger',
              className
            )}
            {...props}
            type={inputType}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252] hover:text-white transition-colors focus:outline-none"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
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
