/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: effect-requires-dispose
 *
 * Warns when effect() is called but the returned stop function is not
 * captured, which may lead to memory leaks if the effect was intended
 * to be cleaned up.
 *
 * Note: This rule may have false positives for intentionally long-lived
 * effects. Use eslint-disable comments for those cases.
 *
 * ⚠️ Warning:
 *   effect(() => { ... });  // stop() not captured
 *
 * ✅ Good:
 *   const stop = effect(() => { ... });
 *   // later: stop();
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when effect() return value (stop function) is not captured",
      recommended: false,
    },
    messages: {
      effectNotCaptured: "The stop() function returned by effect() is not captured. If this effect should be disposed, capture the return value. If it's intentionally long-lived, add an eslint-disable comment.",
    },
    schema: [],
  },

  create(context) {
    return {
      // Match: effect(() => { ... }); as an expression statement
      ExpressionStatement(node) {
        const expr = node.expression;

        // Check if this is a call to effect()
        if (
          expr.type === "CallExpression" &&
          expr.callee?.type === "Identifier" &&
          expr.callee.name === "effect"
        ) {
          context.report({
            node: expr,
            messageId: "effectNotCaptured",
          });
        }
      },
    };
  },
};
