/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const light = css`
  :host {
    color-scheme: light;
  }

  :host([systemthemeoverride]) {
    color-scheme: inherit;
  }
` as CSSResultGroup;
