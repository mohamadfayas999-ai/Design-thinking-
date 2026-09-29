import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = false,
  padding = 'md',
  bordered = true,
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`bg-white rounded-xl ${bordered ? 'border border-slate-200/90' : ''} ${
        paddingStyles[padding]
      } shadow-card transition-all duration-200 ${
        hoverEffect ? 'hover:shadow-hover hover:-translate-y-0.5 hover:border-water-300' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
