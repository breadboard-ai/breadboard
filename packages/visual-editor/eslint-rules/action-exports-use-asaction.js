/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: action-exports-use-asaction
 *
 * Enforces that exported functions/constants in action files use `asAction`.
 * This ensures consistency in the SCA action pattern for extensibility.
 *
 * Only applies to files matching `sca/actions/**\/*-actions.ts`.
 *
 * ❌ BAD:
 *   export async function doSomething() { ... }
 *   export function doOther() { ... }
 *
 * ✅ GOOD:
 *   export const doSomething = asAction("...", ..., async () => { ... });
 *
 * ✅ ALLOWED (not an action):
 *   export const bind = makeAction();  // Special: bind is for setup
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require exported functions in action files to use asAction wrapper",
      recommended: true,
    },
    messages: {
      useAsAction:
        'Exported function "{{name}}" should use asAction wrapper for consistency. Use: export const {{name}} = asAction("...", options, async () => { ... })',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only apply to action files
    const isActionFile =
      filename.includes("sca/actions/") && filename.endsWith("-actions.ts");

    if (!isActionFile) {
      return {};
    }

    return {
      // Check exported function declarations
      ExportNamedDeclaration(node) {
        const declaration = node.declaration;

        // Check for: export async function doSomething() { ... }
        if (declaration?.type === "FunctionDeclaration") {
          const name = declaration.id?.name || "anonymous";

          // Skip utility helpers that aren't actions
          if (name === "persistDataParts") return;
          if (name === "mapLifecycleToRunStatus") return;

          context.report({
            node: declaration,
            messageId: "useAsAction",
            data: { name },
          });
        }

        // Check for: export const foo = ...
        if (declaration?.type === "VariableDeclaration") {
          for (const declarator of declaration.declarations) {
            const name = declarator.id?.name;

            // Skip 'bind' - it's the special setup export
            // Skip utility helpers that aren't actions
            if (name === "bind") continue;
            if (name === "persistDataParts") continue;

            const init = declarator.init;

            // Check if it's NOT a call to asAction
            if (!init) continue;

            const isAsActionCall =
              init.type === "CallExpression" &&
              init.callee?.name === "asAction";

            // If it's a function expression or arrow function without asAction, report
            if (
              init.type === "ArrowFunctionExpression" ||
              init.type === "FunctionExpression"
            ) {
              context.report({
                node: declarator,
                messageId: "useAsAction",
                data: { name },
              });
            }

            // If it's an async function assigned without wrapping
            if (init.type === "CallExpression") {
              // It's OK if it's asAction(...)
              if (isAsActionCall) continue;

              // Other function calls are OK (like makeAction())
            }
          }
        }
      },
    };
  },
};
