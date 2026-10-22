import './helpers/compression';
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// The app autosaves to localStorage; start every test
// from a clean slate so state can't leak between tests.
beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // non-DOM environment
  }
});
