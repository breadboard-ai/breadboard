/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v0_8 } from "../../a2ui/index.js";
import type { ThemeTokens } from "../../a2ui/0.8/styles/tokens.js";

export { applyTokens } from "../../a2ui/0.8/styles/tokens.js";

const tokens: ThemeTokens = {
  // Typography
  "--a2ui-font-family": 'var(--font-family, "Helvetica Neue", sans-serif)',
  "--a2ui-font-family-flex":
    'var(--font-family-flex, "Helvetica Neue", sans-serif)',
  "--a2ui-font-family-mono":
    'var(--font-family-mono, "Courier New", monospace)',

  // Semantic colors
  "--a2ui-color-surface": "var(--light-dark-p-100)",
  "--a2ui-color-on-surface": "var(--light-dark-n-10)",
  "--a2ui-color-primary": "var(--light-dark-p-15)",
  "--a2ui-color-on-primary":
    "light-dark(var(--original-n-100), var(--original-n-0))",
  "--a2ui-color-secondary": "var(--light-dark-p-20)",
  "--a2ui-color-border": "var(--light-dark-s-70)",
  "--a2ui-color-backdrop": "oklch(from var(--light-dark-n-0) l c h / 0.2)",

  // Spacing scale (grid = 4px)
  "--a2ui-spacing-1": "4px",
  "--a2ui-spacing-2": "8px",
  "--a2ui-spacing-3": "12px",
  "--a2ui-spacing-4": "16px",
  "--a2ui-spacing-5": "20px",
  "--a2ui-spacing-6": "24px",

  // Border
  "--a2ui-border-radius": "8px",
  "--a2ui-border-radius-lg": "24px",
  "--a2ui-border-radius-xl": "36px",
  "--a2ui-border-radius-full": "48px",
  "--a2ui-border-width": "1px",

  // Behavior
  "--a2ui-hover-opacity": "0.95",
  "--a2ui-transition-speed": "0.2s",

  // Button
  "--a2ui-button-radius": "var(--a2ui-border-radius-lg)",

  // Image controls (sensible defaults — opt-in overrides)
  "--a2ui-image-button-bg": "oklch(0 0 0 / 0.5)",
  "--a2ui-image-button-bg-hover": "oklch(0 0 0 / 0.7)",
  "--a2ui-image-button-color": "white",
  "--a2ui-image-button-size": "36px",

  // Text: input-prompt variant
  "--a2ui-text-input-prompt-font-family": "var(--a2ui-font-family-flex)",
  "--a2ui-text-input-prompt-font-size": "36px",
  "--a2ui-text-input-prompt-line-height": "44px",
  "--a2ui-text-input-prompt-font-weight": "500",
  "--a2ui-text-input-prompt-text-align": "center",
  "--a2ui-text-input-prompt-font-variation": '"ROND" 100',

  // Text: h1 variant
  "--a2ui-text-h1-font-family": "var(--a2ui-font-family-flex)",
  "--a2ui-text-h1-font-size": "32px",
  "--a2ui-text-h1-line-height": "40px",
  "--a2ui-text-h1-font-weight": "500",
  "--a2ui-text-h1-text-align": "center",
  "--a2ui-text-h1-font-variation": '"ROND" 100',

  // Text: h2-h5 shared base
  "--a2ui-text-subheading-font-family": "var(--a2ui-font-family-flex)",
  "--a2ui-text-subheading-font-weight": "400",
  "--a2ui-text-subheading-text-align": "center",
  "--a2ui-text-subheading-font-variation": '"ROND" 100',
  "--a2ui-text-subheading-color": "var(--a2ui-color-secondary)",

  // Text: individual heading sizes
  "--a2ui-text-h2-font-size": "28px",
  "--a2ui-text-h2-line-height": "36px",
  "--a2ui-text-h3-font-size": "24px",
  "--a2ui-text-h3-line-height": "32px",
  "--a2ui-text-h4-font-size": "20px",
  "--a2ui-text-h4-line-height": "28px",
  "--a2ui-text-h5-font-size": "18px",
  "--a2ui-text-h5-line-height": "24px",

  // Text: caption/body
  "--a2ui-text-body-font-size": "16px",
  "--a2ui-text-body-line-height": "24px",
  "--a2ui-text-body-color": "var(--a2ui-color-secondary)",
};

export const theme: v0_8.Types.Theme = {
  tokens,
  overrides: {
    Button: {
      "--a2ui-button-bg": "var(--a2ui-color-primary)",
      "--a2ui-button-color": "var(--a2ui-color-on-primary)",
    },
    Card: {
      "--a2ui-card-bg": "var(--a2ui-color-surface)",
      "--a2ui-card-radius": "var(--a2ui-border-radius-xl)",
    },
    Modal: {
      "--a2ui-modal-bg": "var(--a2ui-color-surface)",
      "--a2ui-modal-border-color": "var(--light-dark-p-80)",
    },
    TextField: {
      "--a2ui-input-bg": "var(--a2ui-color-surface)",
      "--a2ui-input-border-color": "var(--light-dark-p-60)",
      "--a2ui-input-radius": "var(--a2ui-border-radius-full)",
    },
  },
};
