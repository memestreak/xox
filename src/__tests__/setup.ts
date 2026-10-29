import './helpers/compression';
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetPreferencesForTests } from '../app/preferences';

// The app autosaves to localStorage; start every test
// from a clean slate so state can't leak between tests.
beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // non-DOM environment
  }
  // Preferences also keep the saved value in memory.
  resetPreferencesForTests();
});
