import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, id, className = '', disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 tracking-wide">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 pointer-events-none text-slate-400 flex items-center">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors duration-150 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
              icon ? 'pl-10' : ''
            } ${
              error
                ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                : 'border-slate-300 text-slate-900 focus:border-water-500 focus:ring-water-100 bg-white hover:border-slate-400'
            } ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
