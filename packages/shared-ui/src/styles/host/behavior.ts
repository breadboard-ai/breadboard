/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const behavior = css`
  .cursor {
    &:not([disabled]) {
      cursor: pointer;
    }
  }
` as CSSResultGroup;
