/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-signal-decorator-in-sca
 *
 * Prevents using @signal decorator in SCA code.
 * Use @field decorator instead for consistency.
 *
 * The @field decorator provides wrapped reactivity and can be configured
 * with { deep: true } for collections. It's the standard pattern in SCA.
 *
 * This rule applies only to files within the sca/ directory, excluding
 * the decorators themselves.
 *
 * ❌ Banned in SCA:
 *   import { signal } from "@lit-labs/signals";
 *   @signal
 *   accessor myProp = 0;
 *
 * ✅ Use instead:
 *   import { field } from "../../decorators/field.js";
 *   @field()
 *   private accessor myProp = 0;
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow @signal decorator in SCA code (use @field instead)",
      recommended: true,
    },
    messages: {
      noSignalDecorator:
        "Do not use @signal decorator in SCA code. Use @field from decorators/field.ts instead for consistency.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to files in sca/ directory
    if (!filename.includes("/sca/")) {
      return {};
    }

    // Exclude the decorators directory itself
    if (filename.includes("/sca/controller/decorators/")) {
      return {};
    }

    return {
      // Check for @signal import from @lit-labs/signals
      ImportDeclaration(node) {
        const source = node.source?.value;

        if (source === "@lit-labs/signals") {
          const hasSignalImport = node.specifiers?.some((specifier) => {
            if (specifier.type === "ImportSpecifier") {
              return specifier.imported?.name === "signal";
            }
            return false;
          });

          if (hasSignalImport) {
            context.report({
              node,
              messageId: "noSignalDecorator",
            });
          }
        }
      },

      // Also check decorator usage directly
      Decorator(node) {
        // For simple @signal
        if (node.expression.type === "Identifier" && node.expression.name === "signal") {
          context.report({
            node,
            messageId: "noSignalDecorator",
          });
        }
        // For @signal() call expression
        if (
          node.expression.type === "CallExpression" &&
          node.expression.callee.type === "Identifier" &&
          node.expression.callee.name === "signal"
        ) {
          context.report({
            node,
            messageId: "noSignalDecorator",
          });
        }
      },
    };
  },
};
