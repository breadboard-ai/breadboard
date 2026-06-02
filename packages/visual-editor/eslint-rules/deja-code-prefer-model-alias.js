/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESLint rule: deja-code-prefer-model-alias
 *
 * Déjà Code — prevents hardcoded Gemini model names in the frontend.
 *
 * Pattern:
 *   modelName: "gemini-3-flash-preview"
 *   generateContent("gemini-2.5-pro", body, moduleArgs)
 *   model: "gemini-2.5-flash-image"
 *
 * The frontend should use `MODEL_ALIAS_*` constants from `gemini.ts`
 * instead. The backend remaps aliases to concrete model names, so the
 * frontend never needs to know the actual model version.
 *
 * This rule flags any string literal that looks like a versioned Gemini
 * or Veo model name (e.g. "gemini-3-flash-preview", "veo-3.1-generate-preview").
 * It does NOT flag aliases like "alias-text-flash" or UI identifiers like
 * "gemini-flash".
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Déjà Code: use MODEL_ALIAS_* constants instead of hardcoded Gemini/Veo model names",
      recommended: false,
    },
    messages: {
      preferModelAlias:
        'Déjà Code: don\'t hardcode model name "{{ model }}". ' +
        "Use a MODEL_ALIAS_* constant from gemini.ts — the backend remaps aliases to concrete models.",
    },
    schema: [],
  },

  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (!isHardcodedModelName(node.value)) return;

        context.report({
          node,
          messageId: "preferModelAlias",
          data: { model: node.value },
        });
      },
    };
  },
};

/**
 * Returns true if the string looks like a concrete, versioned model name
 * that should be replaced with an alias.
 *
 * Matches patterns like:
 *   - gemini-2.5-pro
 *   - gemini-3-flash-preview
 *   - gemini-3.1-flash-lite
 *   - gemini-2.0-flash-exp
 *   - gemini-1.5-pro-latest
 *   - veo-3.1-generate-preview
 *   - learnlm-1.5-pro-experimental
 *
 * Does NOT match:
 *   - alias-text-flash (the aliases themselves)
 *   - gemini-flash (UI identifiers without version numbers)
 *   - gemini-prompt (non-model strings)
 */
function isHardcodedModelName(value) {
  return /^(gemini|veo|learnlm)-\d/.test(value);
}
