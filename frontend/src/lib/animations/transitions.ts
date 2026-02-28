/** Duration tokens in seconds (for Framer Motion). Mirror of CSS --duration-* variables. */
export const DURATION = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.6,
};

/** Easing tokens for Framer Motion. --ease-spring mirrors the bounce curve. */
export const EASING = {
  bounce: [0.34, 1.56, 0.64, 1] as const,
  smooth: [0.25, 0.46, 0.45, 0.94] as const,
  snappy: [0.4, 0, 0.2, 1] as const,
};

export const transitions = {
  spring: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 30,
  },
  bouncySpring: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
  },
  smooth: {
    duration: 0.4,
    ease: [0.25, 0.46, 0.45, 0.94],
  },
  bounce: {
    duration: 0.5,
    ease: [0.34, 1.56, 0.64, 1],
  },
};

export const staggerConfig = {
  fast: 0.05,
  normal: 0.08,
  slow: 0.12,
};
