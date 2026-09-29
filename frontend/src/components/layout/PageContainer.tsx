import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = '7xl',
  className = '',
}) => {
  const maxWidthStyles = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <main
      className={`min-h-[calc(100dvh-4rem)] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 ${maxWidthStyles[maxWidth]} ${className}`}
    >
      {children}
    </main>
  );
};
