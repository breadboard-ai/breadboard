/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const colorsLight = css`
  :host {
    --ui-primary: #000000;
    --ui-primary-disabled: oklch(
      from var(--ui-primary) l c h / calc(alpha * 0.38)
    );
    --ui-background: #f1f1f1;
  }

  :host {
    --ui-resting-text: #ababab;
    --ui-secondary-text: #525252;
    --ui-icon: #1b1b1b;
    --ui-text: #1b1b1b;
  }

  :host {
    --ui-custom-o-100: #665ef6;
    --ui-custom-o-10: oklch(from var(--ui-o-100) l c h / calc(alpha * 0.1));
    --ui-custom-o-5: oklch(from var(--ui-o-100) l c h / calc(alpha * 0.05));
  }

  :host {
    --ui-generate: #c2d5fb;
    --ui-generate-secondary: #e0eafe;
    --ui-display: #c4fcd4;
    --ui-display-secondary: #d9ffe4;
    --ui-get-input: #effe96;
    --ui-get-input-secondary: #f2ffa3;
    --ui-asset: #f6c9ad;
    --ui-asset-secondary: #fceee9;
  }

  :host {
    --n-100: #ffffff;
    --n-99: #fcfcfc;
    --n-98: #f9f9f9;
    --n-95: #f1f1f1;
    --n-90: #e2e2e2;
    --n-80: #c6c6c6;
    --n-70: #ababab;
    --n-60: #919191;
    --n-50: #777777;
    --n-40: #5e5e5e;
    --n-35: #525252;
    --n-30: #474747;
    --n-25: #3b3b3b;
    --n-20: #303030;
    --n-15: #262626;
    --n-10: #1b1b1b;
    --n-5: #111111;
    --n-0: #000000;
  }
` as CSSResultGroup;
