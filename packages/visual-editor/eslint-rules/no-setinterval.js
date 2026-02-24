/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-setinterval
 *
 * Flags any call to `setInterval(...)`. Prefer recursive `setTimeout` to
 * avoid leaked-interval bugs — when a new interval is created without
 * clearing the old handle, both run concurrently.
 *
 * Recursive `setTimeout` is self-cleaning: if the next tick is never
 * scheduled (e.g. because the handle was overwritten), the chain stops.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer recursive setTimeout over setInterval to avoid leaked-interval bugs",
      recommended: false,
    },
    messages: {
      noSetInterval:
        "Avoid setInterval — use recursive setTimeout instead. " +
        "setInterval handles can leak when overwritten without clearing, " +
        "causing duplicate tickers. Recursive setTimeout is self-cleaning.",
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        // Match bare `setInterval(...)` calls
        if (callee.type === "Identifier" && callee.name === "setInterval") {
          context.report({ node, messageId: "noSetInterval" });
          return;
        }

        // Match `window.setInterval(...)` or `globalThis.setInterval(...)`
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "setInterval"
        ) {
          context.report({ node, messageId: "noSetInterval" });
        }
      },
    };
  },
};
