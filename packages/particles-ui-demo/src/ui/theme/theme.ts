/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type UITheme = {
  elements: Record<string, Record<string, boolean>>;
  components: Record<string, Record<string, boolean>>;
  layouts: Record<string, Record<string, boolean>>;
  modifiers: Record<string, Record<string, boolean>>;
  additionalStyles: Record<string, string>;
};
