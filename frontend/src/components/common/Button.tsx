import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { playWaterBubbleSound } from '../../utils/sound';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disableSound?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  disableSound = false,
  icon,
  iconPosition = 'left',
  className = '',
  onClick,
  ...props
}, ref) => {
  const shouldReduceMotion = useReducedMotion();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disableSound) {
      playWaterBubbleSound();
    }
    onClick?.(e);
  };

  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg select-none cursor-pointer disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-water-600 hover:bg-water-700 text-white shadow-sm hover:shadow focus:ring-water-500 border border-water-600 hover:border-water-700',
    secondary:
      'bg-slate-100 hover:bg-slate-200 text-slate-800 focus:ring-slate-400 border border-slate-200',
    outline:
      'bg-white hover:bg-water-50 text-water-700 border border-water-300 hover:border-water-400 focus:ring-water-500',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-300',
    danger:
      'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow focus:ring-red-500 border border-red-600',
  };

  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      ref={ref}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={isDisabled}
      onClick={handleClick}
      whileHover={shouldReduceMotion || isDisabled ? undefined : { scale: 1.012, y: -0.5 }}
      whileTap={shouldReduceMotion || isDisabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>
      )}
      <span className="truncate">{children}</span>
      {!isLoading && icon && iconPosition === 'right' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';
