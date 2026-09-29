import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

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
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-water-500" />,
    error: <AlertTriangle className="w-5 h-5 text-red-500" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
    info: 'border-water-200 bg-water-50/80 text-water-900',
    error: 'border-red-200 bg-red-50/80 text-red-900',
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-card text-sm font-medium ${borders[type]} ${className}`}
      role="status"
    >
      <span className="flex-shrink-0">{icons[type]}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
