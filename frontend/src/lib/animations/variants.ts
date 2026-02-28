import type { Variants } from 'framer-motion';

// Durações padrão vibrantes
const DURATION = {
  fast: 0.3,
  normal: 0.4,
  slow: 0.6,
};

// Easing vibrantes com bounce
const EASING = {
  bounce: [0.34, 1.56, 0.64, 1] as const, // Overshoot bounce
  smooth: [0.25, 0.46, 0.45, 0.94] as const,
  snappy: [0.4, 0, 0.2, 1] as const,
};

// Page transitions - apenas fade para evitar movimento do menu lateral
export const pageVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: DURATION.fast,
      ease: EASING.smooth,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast },
  },
};

// Stagger children
export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASING.bounce },
  },
};

// Card animations
export const cardVariants: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 30 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: DURATION.slow,
      ease: EASING.bounce,
    },
  },
  hover: {
    scale: 1.05,
    y: -5,
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    transition: { duration: 0.3, ease: EASING.snappy },
  },
  tap: { scale: 0.98 },
};

// Counter animation (números subindo)
export const counterVariants: Variants = {
  initial: { opacity: 0, scale: 0.5 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: DURATION.slow,
      ease: EASING.bounce,
    },
  },
};

// Form error shake
export const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 },
  },
};

// Success celebration
export const successVariants: Variants = {
  initial: { scale: 0, rotate: -180 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

// Modal/Dialog
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 50 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: EASING.bounce,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: DURATION.fast },
  },
};

// Toast notification
export const toastVariants: Variants = {
  initial: { opacity: 0, y: 50, scale: 0.3 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 40,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    transition: { duration: 0.2 },
  },
};

// Checkbox check animation
export const checkboxVariants: Variants = {
  unchecked: { scale: 0, opacity: 0 },
  checked: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
};

// Empty state
export const emptyStateVariants: Variants = {
  initial: { opacity: 0, y: 40 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.slow,
      ease: EASING.smooth,
    },
  },
};

// Scroll-triggered
export const scrollVariants: Variants = {
  offscreen: { opacity: 0, y: 100 },
  onscreen: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.slow,
      ease: EASING.bounce,
    },
  },
};

// Badge scale in
export const badgeVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

// Success checkmark animation
export const checkmarkVariants: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

// Checkmark circle animation
export const checkmarkCircleVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

// Celebration/confetti animation
export const celebrationVariants: Variants = {
  initial: { scale: 0, rotate: -180 },
  animate: {
    scale: [0, 1.2, 1],
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

// Particle burst animation (for confetti effect)
export const particleVariants: Variants = {
  initial: { scale: 0, opacity: 1 },
  animate: (i: number) => ({
    scale: [0, 1, 0.5],
    opacity: [1, 1, 0],
    x: Math.cos((i * Math.PI * 2) / 8) * 50,
    y: Math.sin((i * Math.PI * 2) / 8) * 50,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  }),
};

// Pulse ring animation (behind success icon)
export const pulseRingVariants: Variants = {
  initial: { scale: 0.8, opacity: 0.5 },
  animate: {
    scale: [0.8, 1.4],
    opacity: [0.5, 0],
    transition: {
      duration: 0.8,
      ease: 'easeOut',
    },
  },
};
