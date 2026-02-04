/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: no-signal-collections-in-sca
 *
 * Prevents using signal-utils collections directly in SCA code.
 * Use @field({ deep: true }) with standard collections instead for consistency.
 *
 * This rule applies only to files within the sca/ directory, excluding
 * the wrap/unwrap utility functions in decorators/field.ts.
 *
 * ❌ Banned in SCA:
 *   import { SignalMap } from "signal-utils/map";
 *   import { SignalSet } from "signal-utils/set";
 *   import { SignalArray } from "signal-utils/array";
 *   import { SignalObject } from "signal-utils/object";
 *
 * ✅ Use instead:
 *   @field({ deep: true })
 *   private accessor myMap: Map<string, Foo> = new Map();
 *
 *   @field({ deep: true })
 *   private accessor mySet: Set<string> = new Set();
 */

// Signal collections to ban and their import sources
const BANNED_COLLECTIONS = {
  SignalMap: "signal-utils/map",
  SignalSet: "signal-utils/set",
  SignalArray: "signal-utils/array",
  SignalObject: "signal-utils/object",
};

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow signal-utils collections in SCA code (use @field({ deep: true }) instead)",
      recommended: true,
    },
    messages: {
      noSignalCollection:
        "Do not use {{ name }} in SCA code. Use @field({ deep: true }) with a standard collection instead for consistency.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to files in sca/ directory
    if (!filename.includes("/sca/")) {
      return {};
    }

    // Exclude the wrap/unwrap utilities that legitimately use signal collections
    if (filename.includes("/decorators/utils/wrap-unwrap.ts")) {
      return {};
    }

    return {
      // Check for signal-utils collection imports
      ImportDeclaration(node) {
        const source = node.source?.value;

        // Check if this import source contains a banned collection
        for (const [name, importSource] of Object.entries(BANNED_COLLECTIONS)) {
          if (source === importSource) {
            const hasImport = node.specifiers?.some((specifier) => {
              if (specifier.type === "ImportSpecifier") {
                return specifier.imported?.name === name;
              }
              return false;
            });

            if (hasImport) {
              context.report({
                node,
                messageId: "noSignalCollection",
                data: { name },
              });
            }
          }
        }
      },

      // Check for new SignalXxx() usage
      NewExpression(node) {
        if (node.callee.type === "Identifier") {
          const name = node.callee.name;
          if (name in BANNED_COLLECTIONS) {
            context.report({
              node,
              messageId: "noSignalCollection",
              data: { name },
            });
          }
        }
      },
    };
  },
};
