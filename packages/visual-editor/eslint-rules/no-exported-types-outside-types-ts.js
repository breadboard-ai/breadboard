/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-exported-types-outside-types-ts
 *
 * Ensures that type definitions (type aliases and interfaces) within the SCA
 * layer are defined in the canonical `sca/types.ts` file, not scattered across
 * individual modules. Cross-package types belong in `@breadboard-ai/types`.
 *
 * Only applies to files under `sca/`.
 *
 * Exempt files:
 * - `types.ts` — the canonical SCA type home
 * - `constants.ts` — the canonical SCA constants home
 * - `sca.ts` — the public API barrel file
 *
 * Exempt patterns:
 * - `export type { X } from "..."` — barrel re-exports, not definitions
 *
 * ❌ BAD:
 *   // in sca/controller/subcontrollers/editor/graph/node-describer.ts
 *   export type NodeDescriber = (...) => Promise<NodeDescriberResult>;
 *
 * ✅ GOOD:
 *   // in sca/types.ts
 *   export type NodeDescriber = (...) => Promise<NodeDescriberResult>;
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent type definitions from being exported outside sca/types.ts",
      recommended: true,
    },
    messages: {
      noExportedType:
        'SCA type "{{name}}" should be defined in sca/types.ts (or @breadboard-ai/types for cross-package types), not in this file.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only apply to files in sca/
    if (!filename.includes("sca/")) {
      return {};
    }

    // Exempt canonical files
    const basename = filename.split("/").pop();
    if (
      basename === "types.ts" ||
      basename === "constants.ts" ||
      basename === "sca.ts"
    ) {
      return {};
    }

    return {
      // export type Foo = ...
      // export interface Foo { ... }
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) {
          // This is `export { ... }` or `export { type ... }` syntax.
          // If it has a `source`, it's a re-export — skip it.
          if (node.source) return;

          // Check for `export { type Foo }` (type-only named exports without source)
          for (const specifier of node.specifiers) {
            if (specifier.exportKind === "type") {
              const name = specifier.exported.name;
              context.report({
                node: specifier,
                messageId: "noExportedType",
                data: { name },
              });
            }
          }
          return;
        }

        // `export type Foo = ...`
        if (decl.type === "TSTypeAliasDeclaration") {
          context.report({
            node: decl,
            messageId: "noExportedType",
            data: { name: decl.id.name },
          });
          return;
        }

        // `export interface Foo { ... }`
        if (decl.type === "TSInterfaceDeclaration") {
          context.report({
            node: decl,
            messageId: "noExportedType",
            data: { name: decl.id.name },
          });
          return;
        }

        // `export enum Foo { ... }` — enums are runtime values, not pure types.
        // Skip them.
      },

      // `export type { X } from "..."` — re-export syntax at the top level
      // Already handled above (node.source check).

      // `export default` — not relevant for types.
    };
  },
};
