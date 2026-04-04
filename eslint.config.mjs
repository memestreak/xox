import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import noConditionalBorder from "./eslint-rules/no-conditional-border.mjs";

// Promote all jsx-a11y rules to error severity.
// eslint-config-next registers the plugin; we only
// override rule levels here.
const a11yErrors = Object.fromEntries(
  Object.keys(jsxA11y.rules).map(
    rule => [`jsx-a11y/${rule}`, 'error']
  )
);

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
      ...a11yErrors,
      // Override rules that conflict with our patterns:
      // Custom sliders/dialogs use ARIA roles intentionally
      'jsx-a11y/prefer-tag-over-role': 'off',
      // Deprecated: modern browsers handle onChange fine
      'jsx-a11y/no-onchange': 'off',
      // Too strict (requires BOTH nesting AND id);
      // label-has-associated-control covers this better
      'jsx-a11y/label-has-for': 'off',
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
