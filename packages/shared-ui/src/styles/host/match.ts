/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const matchOnlyLight = css`
  @media (prefers-color-scheme: dark) {
    :host {
      color-scheme: light;
    }
  }

  @media (prefers-color-scheme: light) {
    :host {
      color-scheme: light;
    }
  }

  @media (prefers-color-scheme: dark) or (prefers-color-scheme: light) {
    :host([systemthemeoverride]) {
      color-scheme: inherit;
    }
  }
` as CSSResultGroup;

export const match = css`
  @media (prefers-color-scheme: dark) {
    :host {
      color-scheme: dark;
    }
  }

  @media (prefers-color-scheme: light) {
    :host {
      color-scheme: light;
    }
  }
` as CSSResultGroup;
