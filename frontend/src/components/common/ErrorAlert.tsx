import React from 'react';
import { AlertCircle, XCircle } from 'lucide-react';

export interface ErrorAlertProps {
  message: string;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  title,
  onDismiss,
  className = '',
}) => {
  return (
    <div
      className={`rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 flex items-start gap-3 ${className}`}
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold text-red-900 mb-0.5">{title}</p>}
        <p className="text-red-700 leading-relaxed">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-700 transition-colors p-0.5 rounded"
          aria-label="Dismiss"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
