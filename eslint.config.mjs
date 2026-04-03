import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noConditionalBorder from "./eslint-rules/no-conditional-border.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      'xox': {
        rules: {
          'no-conditional-border': noConditionalBorder,
        },
      },
    },
    rules: {
      'xox/no-conditional-border': 'error',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktree build artifacts:
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
