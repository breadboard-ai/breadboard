/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const colorScheme = css`
  :host {
    color-scheme: var(--color-scheme, inherit);
  }
` as CSSResultGroup;
