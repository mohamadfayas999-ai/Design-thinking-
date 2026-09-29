import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'water' | 'cyan' | 'emerald' | 'amber' | 'red' | 'slate';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'water',
  size = 'md',
  icon,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-semibold px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    water: 'bg-water-50 text-water-700 border border-water-200/80',
    cyan: 'bg-cyan-50 text-cyan-700 border border-cyan-200/80',
    emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    red: 'bg-red-50 text-red-700 border border-red-200/80',
    slate: 'bg-slate-100 text-slate-700 border border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
