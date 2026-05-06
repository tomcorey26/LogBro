import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactCompiler from "eslint-plugin-react-compiler";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "react-compiler": reactCompiler },
    rules: {
      "react-compiler/react-compiler": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".worktrees/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    ".vercel/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
