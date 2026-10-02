import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { smoothEase } from '../../utils/animations';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  text,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-9 h-9',
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: smoothEase }}
      className={`flex flex-col items-center justify-center gap-3 py-6 ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <Loader2 className={`${sizeMap[size]} animate-spin text-water-600 stroke-[2.2]`} />
      </div>
      {text && <p className="text-xs text-slate-500 font-medium tracking-wide">{text}</p>}
    </motion.div>
  );
};
