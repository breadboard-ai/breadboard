/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-direct-sca-imports
 *
 * Prevents UI components from directly importing SCA action, controller,
 * or service modules. Components should access SCA through the consumed
 * context (this.sca.actions / this.sca.controller / this.sca.services)
 * instead.
 *
 * Applies to files under ui/elements/.
 *
 * BAD:
 *   import * as Theme from "../../../sca/actions/theme/theme-actions.js";
 *   import { add } from "../../../sca/actions/theme/theme-actions.js";
 *   import { AppController } from "../../sca/controller/controller.js";
 *
 * GOOD:
 *   // Access via consumed SCA context:
 *   this.sca.actions.theme.add(appTheme);
 *   this.sca.controller.editor.theme.status;
 *
 * Allowed imports:
 *   import { scaContext } from "../../../sca/context/context.js";
 *   import { type SCA } from "../../../sca/sca.js";
 *   import type { AppController } from "../../controller/controller.js";
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent UI components from directly importing SCA action, controller, or service modules",
      recommended: true,
    },
    messages: {
      noDirectImport:
        'UI components should not directly import from SCA modules. Use the consumed SCA context (this.sca) instead. Offending import: "{{source}}".',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only apply to UI element files
    if (!filename.includes("ui/elements/")) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;

        // Check if import is from sca/actions (action modules),
        // sca/controller, or sca/services
        const isScaImport =
          source.includes("sca/actions/") ||
          source.includes("sca/controller/") ||
          source.includes("sca/services/");

        if (!isScaImport) return;

        // Allow context and SCA type imports
        if (
          source.includes("sca/context/") ||
          source.includes("sca/sca")
        ) {
          return;
        }

        // Allow type-only imports (import type { ... })
        if (node.importKind === "type") return;

        // Allow individual type-only specifiers
        const hasNonTypeSpecifiers = node.specifiers.some((spec) => {
          return spec.importKind !== "type";
        });

        if (!hasNonTypeSpecifiers) return;

        context.report({
          node,
          messageId: "noDirectImport",
          data: { source },
        });
      },
    };
  },
};
