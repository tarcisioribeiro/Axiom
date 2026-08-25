import type { Variants } from 'framer-motion';

import { DURATION, EASING } from './transitions';

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
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASING.smooth },
  },
};

// Card animations
export const cardVariants: Variants = {
  initial: { opacity: 0, scale: 0.98, y: 6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: EASING.smooth,
    },
  },
  hover: {
    scale: 1.012,
    y: -2,
    boxShadow: 'var(--shadow-card-hover)',
    transition: { duration: DURATION.fast, ease: EASING.snappy },
  },
  tap: { scale: 0.98 },
};

// Toast notification — consumido por components/ui/toast.tsx (importado
// como toastMotionVariants para não colidir com o cva() local de mesmo nome).
// Desliza a partir da borda pela qual a ToastViewport ancora (direita em
// telas sm+, topo em mobile) — x, não y, para casar com essa direção.
export const toastVariants: Variants = {
  initial: { opacity: 0, x: '100%', scale: 0.97 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 40,
    },
  },
  exit: {
    opacity: 0,
    x: '100%',
    transition: { duration: 0.2 },
  },
};

// Empty state
export const emptyStateVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.normal,
      ease: EASING.smooth,
    },
  },
};

// Badge scale in
export const badgeVariants: Variants = {
  initial: { scale: 0.9, opacity: 0 },
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

// Checkmark circle animation
export const checkmarkCircleVariants: Variants = {
  initial: { scale: 0.9, opacity: 0 },
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

// Pulse ring animation (behind success icon) — expansão decorativa, não uma
// entrada de conteúdo: o piso de scale 0.9 não se aplica aqui.
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
