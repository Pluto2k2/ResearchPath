import { defineConfig } from 'vitest/config';

// Hides the node:sqlite ExperimentalWarning in the test workers.
export default defineConfig({
  test: {
    execArgv: ['--disable-warning=ExperimentalWarning'],
  },
});
