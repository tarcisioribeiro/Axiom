/** Duration tokens in seconds (for Framer Motion). Mirror of CSS --duration-* variables. */
export const DURATION = {
  fast: 0.15,
  normal: 0.22,
  medium: 0.35,
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

/**
 * Transições padrão. `normal` é o default global (MotionConfig em App.tsx):
 * um `motion.*` sem prop `transition` já sai no padrão — só passe `transition`
 * para fugir dele (ex.: `transitions.fast` em micro-interações).
 */
export const transitions = {
  fast: { duration: DURATION.fast, ease: EASE_OUT },
  normal: { duration: DURATION.normal, ease: EASE_OUT },
};
