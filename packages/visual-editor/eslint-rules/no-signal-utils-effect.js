/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-signal-utils-effect
 *
 * Prevents importing effect from signal-utils/subtle/microtask-effect or
 * signal-utils/subtle/batched-effect, which have bugs with single effects.
 *
 * The microtask-effect uses a shared watcher that doesn't properly re-watch
 * after effect execution, causing effects to stop firing after the first
 * notification. The batched-effect has similar issues.
 *
 * ❌ Banned:
 *   import { effect } from "signal-utils/subtle/microtask-effect";
 *   import { batchedEffect } from "signal-utils/subtle/batched-effect";
 *
 * ✅ Use instead:
 *   import { reactive } from "sca/reactive.js";
 *   // (adjust path based on import location)
 *
 * Our custom `reactive` implementation creates a dedicated watcher per effect
 * and explicitly re-watches after each notification, ensuring reliable
 * reactivity.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing effect from signal-utils (use sca/reactive.ts instead)",
      recommended: true,
    },
    messages: {
      noSignalUtilsEffect:
        "Do not import effect from signal-utils. Use the robust `reactive` from 'sca/reactive.ts' instead. " +
        "The signal-utils effect has a bug where single effects stop firing after the first notification.",
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source?.value;

        // Check for the banned import sources
        if (
          source === "signal-utils/subtle/microtask-effect" ||
          source === "signal-utils/subtle/batched-effect"
        ) {
          // Check for namespace imports (import * as Foo from ...)
          const hasNamespaceImport = node.specifiers?.some((specifier) => {
            return specifier.type === "ImportNamespaceSpecifier";
          });

          // Check for named imports of 'effect' or 'batchedEffect'
          const hasEffectImport = node.specifiers?.some((specifier) => {
            if (specifier.type === "ImportSpecifier") {
              const importedName = specifier.imported?.name;
              return importedName === "effect" || importedName === "batchedEffect";
            }
            return false;
          });

          if (hasNamespaceImport || hasEffectImport) {
            context.report({
              node,
              messageId: "noSignalUtilsEffect",
            });
          }
        }
      },
    };
  },
};
