import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import importX from "eslint-plugin-import-x";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier: prettierPlugin,
      "simple-import-sort": simpleImportSort,
      "import-x": importX,
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-unused-vars": ["error"],
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-console": "off",
      // Import sorting — auto-fixed by eslint --fix (lint-staged + save)
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // Blank line after the last import, no duplicate sources
      "import-x/newline-after-import": "error",
      "import-x/no-duplicates": "error",
    },
  },

  prettierConfig,
];
