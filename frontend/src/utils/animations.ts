import { Transition, Variants } from 'framer-motion';

/**
 * Standard professional easing for WASHWISE
 * Smooth, controlled, no cartoony bounce/overshoot
 */
export const smoothEase = [0.16, 1, 0.3, 1];

export const defaultTransition: Transition = {
  duration: 0.24,
  ease: smoothEase,
};

export const quickTransition: Transition = {
  duration: 0.18,
  ease: smoothEase,
};

/**
 * Page Transitions (Rule 5)
 * Opacity 0 -> 1, translateY 8px -> 0
 */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.16, ease: smoothEase },
  },
};

/**
 * Card / Login Entrance (Rule 8)
 * Opacity 0 -> 1, scale 0.98 -> 1, translateY 8px -> 0
 */
export const loginCardVariants: Variants = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.24, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -6,
    transition: { duration: 0.18, ease: smoothEase },
  },
};

/**
 * Stagger container for dashboards (Rule 13, 17, 25)
 */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: smoothEase },
  },
};

/**
 * Step transitions for multi-step flows (Rule 8, 15)
 */
export const stepVariants: Variants = {
  initial: (direction: number = 1) => ({
    opacity: 0,
    x: direction > 0 ? 12 : -12,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: smoothEase },
  },
  exit: (direction: number = 1) => ({
    opacity: 0,
    x: direction > 0 ? -12 : 12,
    transition: { duration: 0.16, ease: smoothEase },
  }),
};

/**
 * Modal dialog animation (Rule 20, 33)
 */
export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalDialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.16, ease: smoothEase },
  },
};

/**
 * Success scale checkmark icon (Rule 16, 21)
 */
export const successIconVariants: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
      duration: 0.35,
    },
  },
};

/**
 * Tab Content Transition (Rule 26)
 */
export const tabContentVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.14, ease: smoothEase },
  },
};
