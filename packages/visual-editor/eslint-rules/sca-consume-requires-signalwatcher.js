/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: sca-consume-requires-signalwatcher
 *
 * Enforces that classes using @consume({ context: scaContext }) extend SignalWatcher.
 * Without SignalWatcher, signal reads won't trigger component re-renders.
 *
 * ❌ BAD:
 *   @consume({ context: scaContext })
 *   class MyComponent extends LitElement { ... }
 *
 * ✅ GOOD:
 *   @consume({ context: scaContext })
 *   class MyComponent extends SignalWatcher(LitElement) { ... }
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require SignalWatcher mixin for classes using @consume({ context: scaContext })",
      recommended: true,
    },
    messages: {
      missingSignalWatcher: "Classes using @consume({ context: scaContext }) should extend SignalWatcher(LitElement) for automatic reactivity.",
    },
    schema: [],
  },

  create(context) {
    return {
      ClassDeclaration(node) {
        // Check if class has any accessor with @consume({ context: scaContext })
        const hasScaConsume = node.body.body.some((member) => {
          if (member.type !== "AccessorProperty") return false;
          const decorators = member.decorators || [];

          return decorators.some((decorator) => {
            const expr = decorator.expression;
            if (expr?.type !== "CallExpression") return false;
            if (expr.callee?.name !== "consume") return false;

            const args = expr.arguments;
            if (!args || args.length === 0) return false;

            const firstArg = args[0];
            if (firstArg?.type !== "ObjectExpression") return false;

            return firstArg.properties.some((prop) => {
              return (
                prop.type === "Property" &&
                prop.key?.name === "context" &&
                prop.value?.name === "scaContext"
              );
            });
          });
        });

        if (!hasScaConsume) return;

        // Check if class extends SignalWatcher(...)
        const superClass = node.superClass;
        if (!superClass) {
          context.report({
            node: node.id || node,
            messageId: "missingSignalWatcher",
          });
          return;
        }

        // Look for SignalWatcher(...) call expression
        const hasSignalWatcher =
          (superClass.type === "CallExpression" &&
           superClass.callee?.name === "SignalWatcher") ||
          // Also check for chained calls like SignalWatcher(Box)
          (superClass.type === "CallExpression" &&
           superClass.callee?.type === "Identifier" &&
           superClass.callee?.name === "SignalWatcher");

        if (!hasSignalWatcher) {
          context.report({
            node: node.id || node,
            messageId: "missingSignalWatcher",
          });
        }
      },
    };
  },
};
