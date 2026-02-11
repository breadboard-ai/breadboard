/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-cross-action-imports
 *
 * Prevents action modules from importing other action modules.
 * Actions should be independent and not directly call each other.
 * Instead, actions should:
 * - Use the editor/controller APIs directly
 * - Share utility helpers through separate modules
 * - Use SCA triggers for coordination
 *
 * Only applies to files matching `sca/actions/**\/*-actions.ts`.
 *
 * ❌ BAD:
 *   import * as Graph from "../graph/graph-actions.js";
 *   import { update } from "../asset/asset-actions.js";
 *
 * ✅ GOOD:
 *   import { persistDataParts } from "../asset/asset-actions.js"; // utility helper is OK
 *   import { UpdateNode } from "../../../ui/transforms/index.js";
 *
 * Note: Importing explicitly named utility helpers (non-asAction exports) is allowed.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent action modules from importing other action modules",
      recommended: true,
    },
    messages: {
      noNamespaceImport:
        'Action modules should not import other action modules as namespaces. "{{source}}" appears to be an action module. Use editor/controller APIs directly instead. If needed, create a trigger to watch a field on the relevant controller.',
      noActionImport:
        'Action modules should not import actions from other action modules. Import "{{imported}}" from "{{source}}" may be an action. Use editor/controller APIs directly instead. If needed, create a trigger to watch a field on the relevant controller.',
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

    // Extract action module name from current file (e.g., "step" from "step-actions.ts")
    const currentModuleMatch = filename.match(/\/([^/]+)-actions\.ts$/);
    const currentModule = currentModuleMatch ? currentModuleMatch[1] : null;

    // Known utility helpers that are allowed to be imported from action modules
    const allowedHelpers = new Set(["bind", "persistDataParts"]);

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        // Only check imports from action modules
        if (
          typeof source !== "string" ||
          !source.includes("-actions") ||
          !source.includes("../")
        ) {
          return;
        }

        // Skip self-imports within the same action module
        const importedModuleMatch = source.match(/\/([^/]+)-actions/);
        const importedModule = importedModuleMatch
          ? importedModuleMatch[1]
          : null;
        if (importedModule === currentModule) {
          return;
        }

        // Check for namespace imports: import * as Graph from "../graph/graph-actions.js"
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            context.report({
              node: specifier,
              messageId: "noNamespaceImport",
              data: { source },
            });
          }

          // Check for named imports that are not allowed helpers
          if (specifier.type === "ImportSpecifier") {
            const imported = specifier.imported.name;
            if (!allowedHelpers.has(imported)) {
              context.report({
                node: specifier,
                messageId: "noActionImport",
                data: { imported, source },
              });
            }
          }
        }
      },
    };
  },
};
