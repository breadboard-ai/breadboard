/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: deja-code-prefer-format-error
 *
 * Déjà Code — detects inline error-unwrapping patterns that duplicate
 * `formatError()` from `utils/formatting/format-error.ts`.
 *
 * The pattern (appears in 3 flowgen files):
 *   if (typeof error === "object" && error !== null && "error" in error) {
 *     error = error.error;
 *   }
 *   if (typeof error === "object" && error !== null && "message" in error) {
 *     message = error.message;
 *   } else {
 *     message = String(error);
 *   }
 *
 * This multi-statement idiom manually unwraps Breadboard's `{error: ...}`
 * wrapper and extracts a display message. `formatError()` already does this
 * with additional robustness (recursive unwrapping, whitespace trimming).
 *
 * Complexity threshold: the rule only fires when it detects the full
 * two-if-statement sequence (unwrap + extract). A standalone typeof check
 * is never flagged.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Déjà Code: prefer formatError() over inline error unwrapping and message extraction",
      recommended: false,
    },
    messages: {
      preferFormatError:
        "Déjà Code: this is an inline error-unwrapping pattern. " +
        'Use formatError() from "utils/formatting/format-error.ts" instead.',
    },
    schema: [],
  },

  create(context) {
    // Strategy: detect the two-IfStatement fingerprint.
    //
    // Statement 1: if (typeof X === "object" && X !== null && "error" in X)
    //                X = X.error;
    //
    // Statement 2 (next sibling): if (typeof X === "object" ... && "message" in X)
    //                message = X.message;
    //              else
    //                message = String(X);
    //
    // We look for IfStatements whose test is a logical chain containing
    // `"error" in <expr>`, followed by a sibling IfStatement testing
    // `"message" in <expr>`.

    return {
      IfStatement(node) {
        // Check: test contains `"error" in X`
        if (!testContainsPropertyIn(node.test, "error")) return;

        // Check: consequent assigns X = X.error (the unwrap)
        if (!consequentAssignsPropertyAccess(node.consequent, "error")) return;

        // Check: a subsequent sibling is an if that tests `"message" in X`
        // (there may be variable declarations like `let message;` in between)
        const parent = node.parent;
        if (!parent) return;

        const siblings =
          parent.type === "BlockStatement"
            ? parent.body
            : parent.type === "Program"
              ? parent.body
              : null;
        if (!siblings) return;

        const idx = siblings.indexOf(node);
        if (idx === -1) return;

        // Scan forward, skipping VariableDeclarations
        for (let i = idx + 1; i < siblings.length; i++) {
          const nextStmt = siblings[i];
          if (nextStmt.type === "VariableDeclaration") continue;
          if (nextStmt.type !== "IfStatement") break;
          if (!testContainsPropertyIn(nextStmt.test, "message")) break;

          // Full two-statement pattern detected
          context.report({
            node,
            messageId: "preferFormatError",
          });
          return;
        }
      },
    };
  },
};

/**
 * Check if an AST node's test contains `"<prop>" in <expr>`.
 */
function testContainsPropertyIn(node, propName) {
  if (!node) return false;
  if (
    node.type === "BinaryExpression" &&
    node.operator === "in" &&
    node.left.type === "Literal" &&
    node.left.value === propName
  ) {
    return true;
  }
  if (node.type === "LogicalExpression") {
    return (
      testContainsPropertyIn(node.left, propName) ||
      testContainsPropertyIn(node.right, propName)
    );
  }
  return false;
}

/**
 * Check if the consequent contains an assignment like `X = X.<prop>`.
 */
function consequentAssignsPropertyAccess(node, propName) {
  if (!node) return false;
  const stmts = node.type === "BlockStatement" ? node.body : [node];
  for (const stmt of stmts) {
    if (stmt.type !== "ExpressionStatement") continue;
    const expr = stmt.expression;
    if (expr.type !== "AssignmentExpression") continue;
    if (expr.operator !== "=") continue;
    const right = expr.right;
    if (right.type !== "MemberExpression") continue;
    if (right.property.type !== "Identifier") continue;
    if (right.property.name !== propName) continue;
    return true;
  }
  return false;
}
