/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-dynamic-imports-in-sca
 *
 * Prevents dynamic import() usage in SCA action and controller files.
 * This covers both:
 *   - Runtime dynamic imports: await import("...")
 *   - Type-level inline imports: import("...").SomeType
 *
 * Both create implicit, hard-to-trace dependencies and break
 * the static dependency graph that SCA relies on.
 *
 * Applies to files matching:
 *   - sca/actions/**\/*-actions.ts
 *   - sca/controller/**\/*.ts
 *
 * BAD:
 *   const { foo } = await import("../theme/theme-actions.js");
 *   const x: import("@breadboard-ai/types").ConsoleEntry = ...;
 *
 * GOOD:
 *   import { foo } from "../theme/theme-utils.js";
 *   import type { ConsoleEntry } from "@breadboard-ai/types";
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent dynamic import() expressions and inline import() types in SCA actions and controllers",
      recommended: true,
    },
    messages: {
      noDynamicImport:
        "Dynamic import() is not allowed in SCA actions and controllers. Use static imports instead. If you need shared logic across action modules, extract it into a utility module.",
      noImportType:
        "Inline import() type annotations are not allowed in SCA actions and controllers. Use a static 'import type { ... }' at the top of the file instead.",
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
      TSImportType(node) {
        context.report({
          node,
          messageId: "noImportType",
        });
      },
    };
  },
};
