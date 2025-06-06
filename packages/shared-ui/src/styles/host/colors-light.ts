/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";

export const custom = {
  c100: "#665ef6",
};

export const neutral = {
  n100: "#ffffff",
  n99: "#fcfcfc",
  n98: "#f9f9f9",
  n95: "#f1f1f1",
  n90: "#e2e2e2",
  n80: "#c6c6c6",
  n70: "#ababab",
  n60: "#919191",
  n50: "#777777",
  n40: "#5e5e5e",
  n35: "#525252",
  n30: "#474747",
  n25: "#3b3b3b",
  n20: "#303030",
  n15: "#262626",
  n10: "#1b1b1b",
  n5: "#111111",
  n0: "#000000",
};

export const steps = {
  generate: "#c2d5fb",
  generateSecondary: "#e0eafe",
  display: "#c4fcd4",
  displaySecondary: "#d9ffe4",
  getInput: "#effe96",
  getInputSecondary: "#f2ffa3",
  asset: "#f6c9ad",
  assetSecondary: "#fceee9",
};

export const colorsLight = css`
  :host {
    --ui-custom-o-100: ${unsafeCSS(custom.c100)};
    --ui-custom-o-10: oklch(from var(--ui-o-100) l c h / calc(alpha * 0.1));
    --ui-custom-o-5: oklch(from var(--ui-o-100) l c h / calc(alpha * 0.05));
  }

  :host {
    --ui-generate: ${unsafeCSS(steps.generate)};
    --ui-generate-secondary: ${unsafeCSS(steps.generateSecondary)};
    --ui-display: ${unsafeCSS(steps.display)};
    --ui-display-secondary: ${unsafeCSS(steps.displaySecondary)};
    --ui-get-input: ${unsafeCSS(steps.getInput)};
    --ui-get-input-secondary: ${unsafeCSS(steps.getInputSecondary)};
    --ui-asset: ${unsafeCSS(steps.asset)};
    --ui-asset-secondary: ${unsafeCSS(steps.assetSecondary)};
  }

  :host {
    --n-100: ${unsafeCSS(neutral.n100)};
    --n-99: ${unsafeCSS(neutral.n99)};
    --n-98: ${unsafeCSS(neutral.n98)};
    --n-95: ${unsafeCSS(neutral.n95)};
    --n-90: ${unsafeCSS(neutral.n90)};
    --n-80: ${unsafeCSS(neutral.n80)};
    --n-70: ${unsafeCSS(neutral.n70)};
    --n-60: ${unsafeCSS(neutral.n60)};
    --n-50: ${unsafeCSS(neutral.n50)};
    --n-40: ${unsafeCSS(neutral.n40)};
    --n-35: ${unsafeCSS(neutral.n35)};
    --n-30: ${unsafeCSS(neutral.n30)};
    --n-25: ${unsafeCSS(neutral.n25)};
    --n-20: ${unsafeCSS(neutral.n20)};
    --n-15: ${unsafeCSS(neutral.n15)};
    --n-10: ${unsafeCSS(neutral.n10)};
    --n-5: ${unsafeCSS(neutral.n5)};
    --n-0: ${unsafeCSS(neutral.n0)};
  }
` as CSSResultGroup;
