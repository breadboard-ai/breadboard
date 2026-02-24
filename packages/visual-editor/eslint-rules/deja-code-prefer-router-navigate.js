/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: deja-code-prefer-router-navigate
 *
 * Déjà Code — detects raw `window.location` navigation that should use
 * `RouterController.go()` (SPA) or `RouterController.navigateAway()` (full
 * page load).
 *
 * Pattern (assignment):
 *   window.location.href = makeUrl({ ... });
 *
 * Pattern (assign call):
 *   window.location.assign(makeUrl({ ... }));
 *
 * These should use `sca.controller.router.navigateAway(...)` (or `.go()` for
 * SPA navigations) instead.
 *
 * Complexity threshold: only fires when `makeUrl` is the value/argument,
 * indicating an SCA-aware navigation. Raw string assignments (e.g.,
 * `window.location.href = "/_app/"`) are not flagged, since those are
 * typically in bootstrap code outside the SCA context.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Déjà Code: use RouterController.navigateAway() instead of raw window.location navigation with makeUrl()",
      recommended: false,
    },
    messages: {
      preferRouterNavigate:
        "Déjà Code: use `sca.controller.router.navigateAway(init)` for " +
        "full-page navigations, or `router.go(init)` for SPA navigations " +
        "— see RouterController in " +
        "packages/visual-editor/src/sca/controller/subcontrollers/router/router-controller.ts",
    },
    schema: [],
  },

  create(context) {
    return {
      // Detect: window.location.href = makeUrl(...)
      AssignmentExpression(node) {
        if (
          node.operator === "=" &&
          isWindowLocationHref(node.left) &&
          isMakeUrlCall(node.right)
        ) {
          context.report({ node, messageId: "preferRouterNavigate" });
        }
      },

      // Detect: window.location.assign(makeUrl(...))
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          isWindowLocation(node.callee.object) &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "assign" &&
          node.arguments.length === 1 &&
          isMakeUrlCall(node.arguments[0])
        ) {
          context.report({ node, messageId: "preferRouterNavigate" });
        }
      },
    };
  },
};

/**
 * Checks whether a node is `window.location.href`.
 */
function isWindowLocationHref(node) {
  return (
    node.type === "MemberExpression" &&
    isWindowLocation(node.object) &&
    node.property.type === "Identifier" &&
    node.property.name === "href"
  );
}

/**
 * Checks whether a node is `window.location`.
 */
function isWindowLocation(node) {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "window" &&
    node.property.type === "Identifier" &&
    node.property.name === "location"
  );
}

/**
 * Checks whether a node is a call to `makeUrl(...)`.
 */
function isMakeUrlCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "makeUrl"
  );
}
