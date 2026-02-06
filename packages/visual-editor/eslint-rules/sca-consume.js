/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: sca-consume-type
 *
 * Enforces that @consume({ context: scaContext }) decorated accessors
 * use definite assignment (sca!: SCA) instead of optional (sca: SCA | undefined).
 *
 * ❌ BAD:
 *   @consume({ context: scaContext })
 *   accessor sca: SCA | undefined = undefined;
 *
 * ✅ GOOD:
 *   @consume({ context: scaContext })
 *   accessor sca!: SCA;
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce correct typing for @consume({ context: scaContext }) accessors",
      recommended: true,
    },
    messages: {
      noUndefinedType: "@consume({ context: scaContext }) accessor should use definite assignment (sca!: SCA) instead of optional type (SCA | undefined).",
      noUndefinedInitializer: "@consume({ context: scaContext }) accessor should not have '= undefined' initializer. Use definite assignment (sca!: SCA).",
    },
    schema: [],
  },

  create(context) {
    return {
      // Match: @consume({ context: scaContext }) accessor ...
      "AccessorProperty[decorators]"(node) {
        const decorators = node.decorators || [];

        // Check if this accessor has @consume({ context: scaContext })
        const hasScaConsume = decorators.some((decorator) => {
          const expr = decorator.expression;
          if (expr?.type !== "CallExpression") return false;
          if (expr.callee?.name !== "consume") return false;

          // Check for { context: scaContext }
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

        if (!hasScaConsume) return;

        // Check 1: Type annotation should not include "| undefined"
        const typeAnnotation = node.typeAnnotation?.typeAnnotation;
        if (typeAnnotation?.type === "TSUnionType") {
          const hasUndefined = typeAnnotation.types.some(
            (t) => t.type === "TSUndefinedKeyword"
          );
          if (hasUndefined) {
            context.report({
              node: node.typeAnnotation,
              messageId: "noUndefinedType",
            });
          }
        }

        // Check 2: Should not have "= undefined" initializer
        if (
          node.value?.type === "Identifier" &&
          node.value.name === "undefined"
        ) {
          context.report({
            node: node.value,
            messageId: "noUndefinedInitializer",
          });
        }
      },
    };
  },
};
