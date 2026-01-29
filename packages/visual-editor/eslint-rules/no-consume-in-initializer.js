/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-consume-in-initializer
 *
 * Prevents accessing @consume decorated accessors in property initializers
 * or constructors. Context values are undefined until the component is
 * connected to the DOM, so accessing them during class initialization fails.
 *
 * ⚠️ Bug - context not available during initialization:
 *   @consume({ context: scaContext })
 *   accessor sca!: SCA;
 *
 *   @property() accessor foo = this.sca.controller;  // Error!
 *
 *   constructor() {
 *     console.log(this.sca.controller);  // Error!
 *   }
 *
 * ✅ Safe - access inside function (lazy evaluation):
 *   @property() accessor task = new Task(this, {
 *     args: () => [this.sca.controller],  // OK - not executed during init
 *   });
 *
 * ✅ Safe - access after connection:
 *   connectedCallback() {
 *     console.log(this.sca.controller);  // OK
 *   }
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow accessing @consume accessors in property initializers or constructors",
      recommended: true,
    },
    messages: {
      noConsumeInInitializer:
        "Cannot access '{{name}}' in property initializer. @consume context values are undefined until the component is connected to the DOM.",
      noConsumeInConstructor:
        "Cannot access '{{name}}' in constructor. @consume context values are undefined until the component is connected to the DOM.",
    },
    schema: [],
  },

  create(context) {
    // Track @consume accessor names in the current class
    let consumeAccessorNames = new Set();
    // Track context: are we in a constructor or property initializer?
    let inConstructor = false;
    let inPropertyInitializer = false;
    // Track nesting in function expressions (these are safe - lazy evaluation)
    let functionNestingDepth = 0;

    /**
     * Check if a MemberExpression is accessing a @consume accessor via this.X
     * Handles both direct access (this.sca) and chained (this.sca.controller)
     */
    function findConsumeAccess(node) {
      if (node.type !== "MemberExpression") return null;

      // Direct access: this.sca
      if (
        node.object?.type === "ThisExpression" &&
        node.property?.name &&
        consumeAccessorNames.has(node.property.name)
      ) {
        return node.property.name;
      }

      // Chained access: this.sca.controller - check the object recursively
      if (node.object?.type === "MemberExpression") {
        return findConsumeAccess(node.object);
      }

      return null;
    }

    return {
      // When entering a class, collect @consume accessor names
      ClassBody(node) {
        consumeAccessorNames = new Set();

        for (const element of node.body) {
          // Look for accessor properties with @consume decorator
          if (element.type === "AccessorProperty" && element.decorators) {
            const hasConsume = element.decorators.some((decorator) => {
              const expr = decorator.expression;
              if (expr?.type === "CallExpression") {
                return expr.callee?.name === "consume";
              }
              if (expr?.type === "Identifier") {
                return expr.name === "consume";
              }
              return false;
            });

            if (hasConsume && element.key?.name) {
              consumeAccessorNames.add(element.key.name);
            }
          }
        }
      },

      // Track when we enter/exit a constructor
      "MethodDefinition[kind='constructor']"() {
        inConstructor = true;
      },
      "MethodDefinition[kind='constructor']:exit"() {
        inConstructor = false;
      },

      // Track when we enter/exit a property initializer
      // AccessorProperty is for `accessor foo = ...`
      // PropertyDefinition is for regular `foo = ...`
      "AccessorProperty[value]"() {
        inPropertyInitializer = true;
      },
      "AccessorProperty[value]:exit"() {
        inPropertyInitializer = false;
      },
      "PropertyDefinition[value]"() {
        inPropertyInitializer = true;
      },
      "PropertyDefinition[value]:exit"() {
        inPropertyInitializer = false;
      },

      // Track function expressions - access inside these is safe (lazy evaluation)
      ArrowFunctionExpression() {
        functionNestingDepth++;
      },
      "ArrowFunctionExpression:exit"() {
        functionNestingDepth--;
      },
      FunctionExpression() {
        functionNestingDepth++;
      },
      "FunctionExpression:exit"() {
        functionNestingDepth--;
      },

      // Check ALL MemberExpressions for @consume access
      MemberExpression(node) {
        // Skip if not in a dangerous context
        if (!inConstructor && !inPropertyInitializer) return;

        // Skip if inside a function expression (lazy evaluation is safe)
        if (functionNestingDepth > 0) return;

        const consumeName = findConsumeAccess(node);
        if (!consumeName) return;

        // Avoid duplicate reports: only report on the outermost MemberExpression
        // that accesses the @consume accessor
        if (
          node.parent?.type === "MemberExpression" &&
          node.parent.object === node
        ) {
          // This node is the object of a parent MemberExpression
          // The parent will be visited, so skip this one
          return;
        }

        context.report({
          node,
          messageId: inConstructor
            ? "noConsumeInConstructor"
            : "noConsumeInInitializer",
          data: { name: consumeName },
        });
      },
    };
  },
};
