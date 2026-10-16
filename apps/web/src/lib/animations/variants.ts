import type { Variants } from 'framer-motion';

import { transitions } from './transitions';

// Page transitions - apenas fade para evitar movimento do menu lateral
export const pageVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
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
    transition: transitions.normal,
  },
};

// Card animations
export const cardVariants: Variants = {
  initial: { opacity: 0, scale: 0.98, y: 6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.normal,
  },
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
    transition: transitions.fast,
  },
};

// Empty state
export const emptyStateVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
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

/** Deslize lateral entre páginas/etapas; `custom` = direção (1 avança, -1 volta). */
export const slideVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};
