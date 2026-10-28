import './helpers/compression';
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetAutoMinimizeForTests } from '../app/hooks/useAutoMinimizeSetting';
import { resetChooserClickAwayForTests } from '../app/hooks/useChooserClickAwaySetting';

// The app autosaves to localStorage; start every test
// from a clean slate so state can't leak between tests.
beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // non-DOM environment
  }
  // Device settings also remember the last value in
  // memory, for when localStorage is unavailable.
  resetAutoMinimizeForTests();
  resetChooserClickAwayForTests();
});
