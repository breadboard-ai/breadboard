/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: field-deep-for-arrays
 *
 * Suggests using { deep: true } when @field decorator is used with an array
 * or Map type, since mutations won't trigger reactivity without deep tracking.
 *
 * ⚠️ Suggestion:
 *   @field()  // deep: false by default
 *   accessor items: string[] = [];
 *   // items.push() won't trigger reactivity!
 *
 * ✅ Better:
 *   @field({ deep: true })
 *   accessor items: string[] = [];
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Suggest deep: true for @field with array/Map types",
      recommended: false,
    },
    messages: {
      suggestDeepForArray: "This @field has an array/Map type. Consider using @field({ deep: true }) to enable reactivity for mutations like .push() or .set().",
    },
    schema: [],
  },

  create(context) {
    return {
      AccessorProperty(node) {
        const decorators = node.decorators || [];

        // Find @field decorator
        const fieldDecorator = decorators.find((decorator) => {
          const expr = decorator.expression;
          if (expr?.type === "CallExpression") {
            return expr.callee?.name === "field";
          }
          if (expr?.type === "Identifier") {
            return expr.name === "field";
          }
          return false;
        });

        if (!fieldDecorator) return;

        // Check if deep is already specified (either true or false)
        // Only warn if deep is NOT specified at all
        const expr = fieldDecorator.expression;
        if (expr?.type === "CallExpression" && expr.arguments?.length > 0) {
          const firstArg = expr.arguments[0];
          if (firstArg?.type === "ObjectExpression") {
            const hasDeepProperty = firstArg.properties.some(
              (p) => p.type === "Property" && p.key?.name === "deep"
            );
            if (hasDeepProperty) return; // deep is explicitly specified (true or false)
          }
        }

        // Check if type annotation is array or Map
        const typeAnnotation = node.typeAnnotation?.typeAnnotation;
        if (!typeAnnotation) return;

        const isArrayType =
          typeAnnotation.type === "TSArrayType" ||
          (typeAnnotation.type === "TSTypeReference" &&
            (typeAnnotation.typeName?.name === "Array" ||
             typeAnnotation.typeName?.name === "Map" ||
             typeAnnotation.typeName?.name === "Set"));

        // Also check for array literal initializer
        const hasArrayInitializer = node.value?.type === "ArrayExpression";

        if (isArrayType || hasArrayInitializer) {
          context.report({
            node: fieldDecorator,
            messageId: "suggestDeepForArray",
          });
        }
      },
    };
  },
};
