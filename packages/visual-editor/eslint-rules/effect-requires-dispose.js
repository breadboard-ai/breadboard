/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: effect-requires-dispose
 *
 * Warns when reactive() is called but the returned stop function is not
 * captured, which may lead to memory leaks if the effect was intended
 * to be cleaned up.
 *
 * Note: This rule may have false positives for intentionally long-lived
 * effects. Use eslint-disable comments for those cases.
 *
 * ⚠️ Warning:
 *   reactive(() => { ... });  // stop() not captured
 *
 * ✅ Good:
 *   const stop = reactive(() => { ... });
 *   // later: stop();
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when reactive() return value (stop function) is not captured",
      recommended: false,
    },
    messages: {
      reactiveNotCaptured: "The stop() function returned by reactive() is not captured. If this effect should be disposed, capture the return value. If it's intentionally long-lived, add an eslint-disable comment.",
    },
    schema: [],
  },

  create(context) {
    return {
      // Match: reactive(() => { ... }); as an expression statement
      ExpressionStatement(node) {
        const expr = node.expression;

        // Check if this is a call to reactive()
        if (
          expr.type === "CallExpression" &&
          expr.callee?.type === "Identifier" &&
          expr.callee.name === "reactive"
        ) {
          context.report({
            node: expr,
            messageId: "reactiveNotCaptured",
          });
        }
      },
    };
  },
};
