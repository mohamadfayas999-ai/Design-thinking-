import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`min-h-[280px] w-full flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-water-50 text-water-600 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mt-1 mb-4">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
