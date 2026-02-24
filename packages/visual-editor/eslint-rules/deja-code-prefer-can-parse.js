/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: deja-code-prefer-can-parse
 *
 * Déjà Code — detects stale URL.canParse polyfill patterns.
 *
 * Pattern:
 *   if ("canParse" in URL) { return URL.canParse(url); }
 *   try { new URL(url); return true; } catch { return false; }
 *
 * All target browsers now support `URL.canParse()` natively, so the
 * polyfill is dead code. Use `URL.canParse()` directly instead.
 *
 * Complexity threshold: this rule only fires when it detects the full
 * multi-statement polyfill guard (`"canParse" in URL` or string-concat
 * obfuscation variants). Bare `URL.canParse()` calls are fine and not
 * flagged.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Déjà Code: remove stale URL.canParse polyfill — all target browsers support it natively",
      recommended: false,
    },
    messages: {
      preferCanParse:
        "Déjà Code: this URL.canParse polyfill is no longer needed. " +
        "All target browsers support URL.canParse() natively — use it directly.",
    },
    schema: [],
  },

  create(context) {
    return {
      // Detect: if ("canParse" in URL) — the polyfill guard
      //
      // Matches IfStatements whose test is a BinaryExpression with
      // operator "in", left side is a string literal containing "canParse"
      // (including obfuscated forms like "" + "canParse" or "c" + "anParse"),
      // and right side is the Identifier `URL`.
      IfStatement(node) {
        if (!isCanParseInUrlTest(node.test)) return;

        context.report({
          node,
          messageId: "preferCanParse",
        });
      },
    };
  },
};

/**
 * Checks whether an AST node is a `"canParse" in URL` test,
 * including string-concatenation obfuscations like `"" + "canParse"` or
 * `"c" + "anParse"`.
 */
function isCanParseInUrlTest(test) {
  if (test.type !== "BinaryExpression" || test.operator !== "in") return false;

  // Right side must be the `URL` identifier
  if (test.right.type !== "Identifier" || test.right.name !== "URL")
    return false;

  // Left side: either a literal "canParse" or a concatenation that yields it
  return evaluatesToCanParse(test.left);
}

/**
 * Returns true if the node is a string expression that evaluates to "canParse".
 * Handles:
 *   - Literal string "canParse"
 *   - BinaryExpression "+" of two literals (e.g., "" + "canParse", "c" + "anParse")
 */
function evaluatesToCanParse(node) {
  if (node.type === "Literal" && node.value === "canParse") return true;

  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = node.left;
    const right = node.right;
    if (
      left.type === "Literal" &&
      typeof left.value === "string" &&
      right.type === "Literal" &&
      typeof right.value === "string" &&
      left.value + right.value === "canParse"
    ) {
      return true;
    }
  }

  return false;
}
