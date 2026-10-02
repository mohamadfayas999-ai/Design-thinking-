import React from 'react';
import { motion, HTMLMotionProps, useReducedMotion } from 'framer-motion';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
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
  const shouldReduceMotion = useReducedMotion();

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <motion.div
      className={`bg-white rounded-xl ${bordered ? 'border border-slate-200/90' : ''} ${
        paddingStyles[padding]
      } shadow-card transition-colors duration-200 ${
        hoverEffect ? 'hover:shadow-hover hover:border-water-300' : ''
      } ${className}`}
      whileHover={
        hoverEffect && !shouldReduceMotion
          ? { y: -2, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
          : undefined
      }
      {...props}
    >
      {children}
    </motion.div>
  );
};
