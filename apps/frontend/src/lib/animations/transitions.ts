/** Duration tokens in seconds (for Framer Motion). Mirror of CSS --duration-* variables. */
export const DURATION = {
  fast: 0.2,
  normal: 0.3,
  medium: 0.4,
  slow: 0.6,
};

/**
 * Easing tokens for Framer Motion.
 *
 * EASE_OUT / EASE_IN_OUT mirror the CSS --ease-out / --ease-in-out tokens in
 * index.css numerically — keep both in sync if either changes. Prefer these
 * two for new code instead of adding another ad-hoc curve.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const EASING = {
  // ease-out suave sem overshoot — adequado para contexto financeiro
  bounce: [0.22, 1.0, 0.36, 1] as const,
  smooth: [0.25, 0.46, 0.45, 0.94] as const,
  snappy: [0.4, 0, 0.2, 1] as const,
  // overshoot reservado para animações comemorativas
  celebration: [0.34, 1.56, 0.64, 1] as const,
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
    duration: DURATION.medium,
    ease: [0.25, 0.46, 0.45, 0.94],
  },
  bounce: {
    duration: DURATION.medium,
    ease: [0.22, 1.0, 0.36, 1],
  },
};

export const staggerConfig = {
  fast: 0.05,
  normal: 0.08,
  slow: 0.12,
};
