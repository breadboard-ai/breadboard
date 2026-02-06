/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: field-decorator-only-on-root-controller
 *
 * Enforces that @field decorator is only used on classes extending RootController.
 * The @field decorator relies on RootController's hydration lifecycle.
 *
 * ❌ BAD:
 *   class MyClass {
 *     @field({ persist: "local" })
 *     accessor value = "";
 *   }
 *
 * ✅ GOOD:
 *   class MyController extends RootController {
 *     @field({ persist: "local" })
 *     accessor value = "";
 *   }
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require @field decorator to be used only on RootController subclasses",
      recommended: true,
    },
    messages: {
      fieldRequiresRootController: "@field decorator requires the class to extend RootController (directly or indirectly).",
    },
    schema: [],
  },

  create(context) {
    return {
      ClassDeclaration(node) {
        // Check if class has any accessor with @field decorator
        const hasFieldDecorator = node.body.body.some((member) => {
          if (member.type !== "AccessorProperty") return false;
          const decorators = member.decorators || [];

          return decorators.some((decorator) => {
            const expr = decorator.expression;
            // Match @field() or @field({ ... })
            if (expr?.type === "CallExpression") {
              return expr.callee?.name === "field";
            }
            // Match @field (without call)
            if (expr?.type === "Identifier") {
              return expr.name === "field";
            }
            return false;
          });
        });

        if (!hasFieldDecorator) return;

        // Check if class extends something containing "Controller" in the name
        // This is a heuristic since we can't do full inheritance analysis
        const superClass = node.superClass;
        if (!superClass) {
          context.report({
            node: node.id || node,
            messageId: "fieldRequiresRootController",
          });
          return;
        }

        // Get the name of what we're extending
        const getSuperClassName = (expr) => {
          if (expr.type === "Identifier") {
            return expr.name;
          }
          if (expr.type === "CallExpression" && expr.callee) {
            return getSuperClassName(expr.callee);
          }
          if (expr.type === "MemberExpression" && expr.property) {
            return expr.property.name;
          }
          return null;
        };

        const superClassName = getSuperClassName(superClass);

        // Check if extends RootController or *Controller (common pattern)
        const isController =
          superClassName === "RootController" ||
          (superClassName && superClassName.endsWith("Controller"));

        if (!isController) {
          context.report({
            node: node.id || node,
            messageId: "fieldRequiresRootController",
          });
        }
      },
    };
  },
};
