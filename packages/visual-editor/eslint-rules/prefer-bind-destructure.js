/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: prefer-bind-destructure
 *
 * Enforces destructuring `bind.controller` and `bind.services` at the top of
 * Action and Trigger functions, rather than accessing them directly inline.
 *
 * ⚠️ Discouraged:
 *   bind.controller.router.updateFromCurrentUrl();
 *   bind.services.agentContext.clearAllRuns();
 *
 * ✅ Preferred:
 *   const { controller, services } = bind;
 *   controller.router.updateFromCurrentUrl();
 *   services.agentContext.clearAllRuns();
 *
 * This pattern improves readability and makes the dependencies clear at the
 * start of each function.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer destructuring bind.controller/bind.services at function start",
      recommended: false,
    },
    messages: {
      preferDestructure:
        "Prefer destructuring '{{ property }}' from 'bind' at the start of the function: const { {{ property }} } = bind;",
    },
    schema: [],
  },

  create(context) {
    // Track which properties we care about
    const bindProperties = new Set(["controller", "services", "actions"]);

    return {
      MemberExpression(node) {
        // We're looking for patterns like: bind.controller.something
        // This means the parent is also a MemberExpression where our node is the object

        // Check if this is a direct property access on 'bind'
        // bind.controller or bind.services
        if (
          node.object.type === "Identifier" &&
          node.object.name === "bind" &&
          node.property.type === "Identifier" &&
          bindProperties.has(node.property.name)
        ) {
          const property = node.property.name;

          // Check if this is being used for chained access (bind.controller.something)
          // We allow standalone bind.controller in destructuring: const { controller } = bind
          // but we don't want bind.controller.router.doThing()

          // If parent is also a MemberExpression where we are the object, it's chained access
          const parent = node.parent;

          if (parent && parent.type === "MemberExpression" && parent.object === node) {
            // This is a chained access like bind.controller.router
            context.report({
              node,
              messageId: "preferDestructure",
              data: { property },
            });
          }
        }
      },
    };
  },
};
