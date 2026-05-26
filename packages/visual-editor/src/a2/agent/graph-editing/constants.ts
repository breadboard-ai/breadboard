/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The Generate component URL from A2_COMPONENTS.
 */
export const GENERATE_COMPONENT_URL =
  "embed://a2/generate.bgl.json#module:main";

/**
 * The User Input component URL from A2_COMPONENTS.
 */
export const USER_INPUT_COMPONENT_URL =
  "embed://a2/a2.bgl.json#21ee02e7-83fa-49d0-964c-0cab10eafc2c";

/**
 * The Output component URL from A2_COMPONENTS.
 */
export const OUTPUT_COMPONENT_URL =
  "embed://a2/a2.bgl.json#module:render-outputs";

/**
 * Maps a legacy step type to its configuration properties.
 */
export const LEGACY_OPTION_MAP: Record<string, Record<string, string>> = {
  "user-input": {
    modality: "p-modality",
    required: "p-required",
  },
  output: {
    render_mode: "p-render-mode",
    doc_title: "b-doc-title",
  },
  "text-3-flash": {
    system_instruction: "b-system-instruction",
  },
  "text-3-pro": {
    system_instruction: "b-system-instruction",
  },
  image: {
    system_instruction: "b-system-instruction",
  },
  "image-pro": {
    system_instruction: "b-system-instruction",
  },
  audio: {
    system_instruction: "b-system-instruction",
  },
  video: {
    system_instruction: "b-system-instruction",
  },
  music: {
    system_instruction: "b-system-instruction",
  },
};
