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
  markdown: {
    p: string[];
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
    ul: string[];
    ol: string[];
    li: string[];
    a: string[];
    strong: string[];
    em: string[];
  };
};
