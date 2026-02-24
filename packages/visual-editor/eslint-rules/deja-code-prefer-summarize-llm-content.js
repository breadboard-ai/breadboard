/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: deja-code-prefer-summarize-llm-content
 *
 * Déjà Code — detects the inline "summarize LLMContent to a preview string"
 * pattern that was independently implemented in create-chiclets.ts and
 * create-truncated-value.ts.
 *
 * The multi-statement pattern:
 *   if (isLLMContent(value)) { value = [value]; }
 *   if (isLLMContentArray(value)) {
 *     const firstValue = value[0];
 *     if (firstValue) {
 *       const firstPart = firstValue.parts[0];
 *       if (isTextCapabilityPart(firstPart)) { ... }
 *       else if (isInlineData(firstPart)) { ... }
 *       else if (isStoredData(firstPart)) { ... }
 *     }
 *   }
 *
 * Complexity threshold: this rule requires the full multi-statement sequence:
 *   1. An isLLMContent(x) check followed by wrapping in an array
 *   2. An isLLMContentArray(x) check with nested firstPart extraction
 * A standalone isLLMContent or isLLMContentArray call is never flagged.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Déjà Code: prefer summarizeLLMContentValue() over inline LLM content preview extraction",
      recommended: false,
    },
    messages: {
      preferSummarizeLLMContent:
        "Déjà Code: this is the inline LLM content preview pattern " +
        "(normalize → extract firstPart → branch on type). " +
        "Use summarizeLLMContentValue() from utils/summarize-llm-content.ts instead.",
    },
    schema: [],
  },

  create(context) {
    // Strategy:
    // Detect the structural fingerprint: an IfStatement whose test calls
    // `isLLMContent(x)` and whose consequent assigns `x = [x]`, FOLLOWED
    // by an IfStatement whose test calls `isLLMContentArray(x)`.
    //
    // This two-statement sequence is unique to this pattern — it's the
    // normalize-then-inspect idiom.

    return {
      IfStatement(node) {
        // Match: if (isLLMContent(x)) { x = [x]; }
        if (!isCallTo(node.test, "isLLMContent")) return;

        // Check the consequent for an assignment wrapping in array
        const body = statementsOf(node.consequent);
        if (!body.some(isArrayWrapAssignment)) return;

        // Now look for the next sibling: if (isLLMContentArray(x)) { ... }
        const parent = node.parent;
        if (!parent) return;

        const siblings =
          parent.type === "BlockStatement"
            ? parent.body
            : parent.type === "Program"
              ? parent.body
              : [];

        const selfIndex = siblings.indexOf(node);
        if (selfIndex < 0 || selfIndex >= siblings.length - 1) return;

        const nextSibling = siblings[selfIndex + 1];
        if (nextSibling.type !== "IfStatement") return;
        if (!isCallTo(nextSibling.test, "isLLMContentArray")) return;

        // Full pattern matched: normalize + inspect
        context.report({
          node,
          messageId: "preferSummarizeLLMContent",
        });
      },
    };
  },
};

/**
 * Check if an AST node is a call to a specific function name.
 */
function isCallTo(node, functionName) {
  if (node.type !== "CallExpression") return false;
  if (node.callee.type === "Identifier" && node.callee.name === functionName) {
    return true;
  }
  return false;
}

/**
 * Extract statements from a consequent (handles both block and expression).
 */
function statementsOf(node) {
  if (node.type === "BlockStatement") return node.body;
  return [node];
}

/**
 * Check if a statement is an array-wrap assignment: x = [x]
 */
function isArrayWrapAssignment(stmt) {
  if (stmt.type !== "ExpressionStatement") return false;
  const expr = stmt.expression;
  if (expr.type !== "AssignmentExpression") return false;
  if (expr.operator !== "=") return false;
  return expr.right.type === "ArrayExpression";
}
