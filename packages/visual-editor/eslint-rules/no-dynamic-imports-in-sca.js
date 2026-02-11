/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-dynamic-imports-in-sca
 *
 * Prevents dynamic import() expressions in SCA action and controller files.
 * Dynamic imports create implicit, hard-to-trace dependencies and break
 * the static dependency graph that SCA relies on.
 *
 * Applies to files matching:
 *   - sca/actions/**\/*-actions.ts
 *   - sca/controller/**\/*.ts
 *
 * BAD:
 *   const { foo } = await import("../theme/theme-actions.js");
 *
 * GOOD:
 *   import { foo } from "../theme/theme-utils.js";
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent dynamic import() expressions in SCA actions and controllers",
      recommended: true,
    },
    messages: {
      noDynamicImport:
        "Dynamic import() is not allowed in SCA actions and controllers. Use static imports instead. If you need shared logic across action modules, extract it into a utility module.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    const isScaFile =
      (filename.includes("sca/actions/") &&
        filename.endsWith("-actions.ts")) ||
      (filename.includes("sca/controller/") && filename.endsWith(".ts"));

    if (!isScaFile) {
      return {};
    }

    return {
      ImportExpression(node) {
        context.report({
          node,
          messageId: "noDynamicImport",
        });
      },
    };
  },
};
