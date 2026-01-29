/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-optional-chaining-on-sca-controller
 *
 * Warns against unnecessary optional chaining on sca.controller when
 * the class has properly typed @consume({ context: scaContext }).
 *
 * With `accessor sca!: SCA`, the context is always provided, so optional
 * chaining is unnecessary and may hide real type issues.
 *
 * ❌ Unnecessary:
 *   this.sca?.controller.global.flags
 *
 * ✅ Better:
 *   this.sca.controller.global.flags
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn against optional chaining on properly typed SCA context",
      recommended: false,
    },
    messages: {
      unnecessaryOptionalChaining: "Unnecessary optional chaining on 'this.sca'. With '@consume({ context: scaContext })' and definite assignment (sca!: SCA), the context is always provided.",
    },
    schema: [],
  },

  create(context) {
    let hasScaConsumeWithDefiniteAssignment = false;

    return {
      // First, check if this class has @consume({ context: scaContext }) with !
      ClassDeclaration(node) {
        hasScaConsumeWithDefiniteAssignment = node.body.body.some((member) => {
          if (member.type !== "AccessorProperty") return false;
          if (!member.definite) return false; // Check for ! (definite assignment)

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
      },

      // Check for this.sca?.
      "ChainExpression > MemberExpression"(node) {
        if (!hasScaConsumeWithDefiniteAssignment) return;

        // Check if this is this.sca?.
        const object = node.object;
        if (
          object?.type === "MemberExpression" &&
          object.object?.type === "ThisExpression" &&
          object.property?.name === "sca" &&
          object.optional === true
        ) {
          context.report({
            node: object,
            messageId: "unnecessaryOptionalChaining",
          });
        }

        // Also check direct this.sca?. usage
        if (
          node.object?.type === "ThisExpression" &&
          node.property?.name === "sca" &&
          node.optional === true
        ) {
          context.report({
            node,
            messageId: "unnecessaryOptionalChaining",
          });
        }
      },
    };
  },
};
