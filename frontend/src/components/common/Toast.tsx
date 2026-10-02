import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { smoothEase } from '../../utils/animations';

export interface ToastProps {
  type?: 'success' | 'warning' | 'info' | 'error';
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  message,
  onClose,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-water-500" />,
    error: <AlertTriangle className="w-5 h-5 text-red-500" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-emerald-50/90 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50/90 text-amber-900',
    info: 'border-water-200 bg-water-50/90 text-water-900',
    error: 'border-red-200 bg-red-50/90 text-red-900',
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.22, ease: smoothEase }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-card text-sm font-medium ${borders[type]} ${className}`}
      role="status"
    >
      <motion.span
        initial={shouldReduceMotion ? undefined : { scale: 0.85 }}
        animate={shouldReduceMotion ? undefined : { scale: 1 }}
        transition={{ duration: 0.2, ease: smoothEase }}
        className="flex-shrink-0"
      >
        {icons[type]}
      </motion.span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-black/5 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};
