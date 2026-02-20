import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Required for React 19 act() support in non-browser test environments
// @ts-expect-error - IS_REACT_ACT_ENVIRONMENT is a React internal testing global
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});
