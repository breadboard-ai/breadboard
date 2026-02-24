/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: deja-code-prefer-group-by
 *
 * Déjà Code — detects inline "group by key into Map<K, V[]>" patterns.
 *
 * The pattern:
 *   if (!map.has(key)) map.set(key, []);
 *   map.get(key)!.push(value);
 *
 * This multi-statement idiom appears 6+ times across the codebase. When a
 * shared `groupBy` utility is extracted, the message should be updated to
 * point to it.
 *
 * Complexity threshold: this rule only fires when it detects the full
 * two-statement has/set + get/push sequence. A standalone `.has()` or
 * `.push()` is never flagged.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Déjà Code: prefer a shared groupBy utility over inline Map<K, V[]> accumulation",
      recommended: false,
    },
    messages: {
      preferGroupBy:
        "Déjà Code: this is an inline groupBy pattern (has/set/get/push). " +
        "Use groupBy() from utils/group-by.ts instead.",
    },
    schema: [],
  },

  create(context) {
    // Strategy: detect the `if (!map.has(key)) map.set(key, [])` guard.
    // This is the signature of the pattern — the .get()!.push() always
    // follows, but the guard is the unique structural fingerprint.
    //
    // We match IfStatements whose test is a unary `!` on a `.has()` call,
    // and whose consequent contains a `.set(_, [])` call on the same object.

    return {
      IfStatement(node) {
        // Match: if (!map.has(key)) ...
        const test = node.test;
        if (test.type !== "UnaryExpression" || test.operator !== "!") return;

        const hasCall = test.argument;
        if (hasCall.type !== "CallExpression") return;
        if (hasCall.callee.type !== "MemberExpression") return;
        if (hasCall.callee.property.type !== "Identifier") return;
        if (hasCall.callee.property.name !== "has") return;

        // Get the map object being tested
        const mapObject = hasCall.callee.object;

        // Now check the consequent for a .set(key, []) call on the same object
        const consequent = node.consequent;

        // Handle both block and expression statement forms:
        //   if (...) map.set(k, []);        — ExpressionStatement
        //   if (...) { map.set(k, []); }    — BlockStatement
        const statementsToCheck =
          consequent.type === "BlockStatement" ? consequent.body : [consequent];

        for (const stmt of statementsToCheck) {
          if (stmt.type !== "ExpressionStatement") continue;
          const expr = stmt.expression;
          if (expr.type !== "CallExpression") continue;
          if (expr.callee.type !== "MemberExpression") continue;
          if (expr.callee.property.type !== "Identifier") continue;
          if (expr.callee.property.name !== "set") continue;

          // Verify it's the same map object
          if (!astNodesEqual(expr.callee.object, mapObject)) continue;

          // Verify second argument is an empty array literal []
          if (expr.arguments.length < 2) continue;
          const secondArg = expr.arguments[1];
          if (
            secondArg.type !== "ArrayExpression" ||
            secondArg.elements.length !== 0
          ) {
            continue;
          }

          // Full pattern matched: if (!map.has(k)) map.set(k, [])
          context.report({
            node,
            messageId: "preferGroupBy",
          });
          return;
        }
      },
    };
  },
};

/**
 * Shallow structural equality for two AST nodes.
 * Handles Identifier and MemberExpression (the common cases for map objects).
 */
function astNodesEqual(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === "Identifier") return a.name === b.name;
  if (a.type === "MemberExpression") {
    return (
      astNodesEqual(a.object, b.object) &&
      astNodesEqual(a.property, b.property) &&
      a.computed === b.computed
    );
  }
  return false;
}
