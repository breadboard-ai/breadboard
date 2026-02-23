/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint Flat Config for the Breadboard monorepo.
 * Uses native ESM imports for local rules.
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import * as expectType from "eslint-plugin-expect-type";

// Import local SCA rules as ESM modules
import scaConsumeType from "./packages/visual-editor/eslint-rules/sca-consume.js";
import scaConsumeRequiresSignalwatcher from "./packages/visual-editor/eslint-rules/sca-consume-requires-signalwatcher.js";
import fieldDecoratorOnlyOnRootController from "./packages/visual-editor/eslint-rules/field-decorator-only-on-root-controller.js";
import noOptionalChainingOnScaController from "./packages/visual-editor/eslint-rules/no-optional-chaining-on-sca-controller.js";
import effectRequiresDispose from "./packages/visual-editor/eslint-rules/effect-requires-dispose.js";
import fieldDeepForArrays from "./packages/visual-editor/eslint-rules/field-deep-for-arrays.js";
import noConsumeInInitializer from "./packages/visual-editor/eslint-rules/no-consume-in-initializer.js";
import preferBindDestructure from "./packages/visual-editor/eslint-rules/prefer-bind-destructure.js";
import noSignalUtilsEffect from "./packages/visual-editor/eslint-rules/no-signal-utils-effect.js";
import noSignalCollectionsInSca from "./packages/visual-editor/eslint-rules/no-signal-collections-in-sca.js";
import noSignalDecoratorInSca from "./packages/visual-editor/eslint-rules/no-signal-decorator-in-sca.js";
import actionExportsUseAsaction from "./packages/visual-editor/eslint-rules/action-exports-use-asaction.js";
import noCrossActionImports from "./packages/visual-editor/eslint-rules/no-cross-action-imports.js";
import noDynamicImportsInSca from "./packages/visual-editor/eslint-rules/no-dynamic-imports-in-sca.js";
import noDirectScaImports from "./packages/visual-editor/eslint-rules/no-direct-sca-imports.js";

// Déjà Code rules — detect inline reimplementations of existing utilities
import dejaCodePreferGroupBy from "./packages/visual-editor/eslint-rules/deja-code-prefer-group-by.js";
import dejaCodePreferSummarizeLLMContent from "./packages/visual-editor/eslint-rules/deja-code-prefer-summarize-llm-content.js";
import dejaCodePreferFormatError from "./packages/visual-editor/eslint-rules/deja-code-prefer-format-error.js";

// Create local rules plugin
const localRulesPlugin = {
  meta: {
    name: "local-rules",
    version: "1.0.0",
  },
  rules: {
    "sca-consume-type": scaConsumeType,
    "sca-consume-requires-signalwatcher": scaConsumeRequiresSignalwatcher,
    "field-decorator-only-on-root-controller":
      fieldDecoratorOnlyOnRootController,
    "no-optional-chaining-on-sca-controller": noOptionalChainingOnScaController,
    "effect-requires-dispose": effectRequiresDispose,
    "field-deep-for-arrays": fieldDeepForArrays,
    "no-consume-in-initializer": noConsumeInInitializer,
    "prefer-bind-destructure": preferBindDestructure,
    "no-signal-utils-effect": noSignalUtilsEffect,
    "no-signal-collections-in-sca": noSignalCollectionsInSca,
    "no-signal-decorator-in-sca": noSignalDecoratorInSca,
    "action-exports-use-asaction": actionExportsUseAsaction,
    "no-cross-action-imports": noCrossActionImports,
    "no-dynamic-imports-in-sca": noDynamicImportsInSca,
    "no-direct-sca-imports": noDirectScaImports,
    // Déjà Code
    "deja-code-prefer-group-by": dejaCodePreferGroupBy,
    "deja-code-prefer-summarize-llm-content": dejaCodePreferSummarizeLLMContent,
    "deja-code-prefer-format-error": dejaCodePreferFormatError,
  },
};

export default tseslint.config(
  // Global ignores
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },

  // Base recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // TypeScript files configuration (all packages)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // TypeScript rules (all packages)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "_.*" },
      ],
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
    },
  },

  // Visual Editor specific rules (SCA + expect-type)
  {
    files: ["packages/visual-editor/src/**/*.ts"],
    plugins: {
      "expect-type": expectType,
      "local-rules": localRulesPlugin,
    },
    rules: {
      // Local SCA rules - High priority (errors)
      "local-rules/sca-consume-type": "error",
      "local-rules/sca-consume-requires-signalwatcher": "error",
      "local-rules/field-decorator-only-on-root-controller": "error",
      "local-rules/no-consume-in-initializer": "error",

      // Local SCA rules - Medium/Lower priority (warnings)
      "local-rules/no-optional-chaining-on-sca-controller": "warn",
      "local-rules/effect-requires-dispose": "warn",
      "local-rules/field-deep-for-arrays": "warn",
      "local-rules/prefer-bind-destructure": "warn",
      "local-rules/no-signal-utils-effect": "error",
      "local-rules/no-signal-collections-in-sca": "error",
      "local-rules/no-signal-decorator-in-sca": "error",
      "local-rules/action-exports-use-asaction": "warn",
      "local-rules/no-cross-action-imports": "error",
      "local-rules/no-dynamic-imports-in-sca": "error",
      "local-rules/no-direct-sca-imports": "error",

      // Déjà Code — flag inline reimplementations of shared utilities
      "local-rules/deja-code-prefer-group-by": "error",
      "local-rules/deja-code-prefer-summarize-llm-content": "error",
      "local-rules/deja-code-prefer-format-error": "error",

      // expect-type rules (requires type information)
      "expect-type/expect": "error",
    },
  },

  // No console in SCA — use Logger instead.
  // Legitimate uses should be marked with eslint-disable + a reason comment.
  // CI enforces this as an error via --max-warnings=0.
  {
    files: ["packages/visual-editor/src/sca/**/*.ts"],
    rules: {
      "no-console": "warn",
    },
  },

  // JavaScript files configuration
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  }
);
