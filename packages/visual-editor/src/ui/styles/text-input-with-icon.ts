/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const textInputWithIcon = css`
  .bb-text-input-with-icon {
    background: var(--bb-icon, var(--bb-icon-help)) no-repeat right 10px bottom
      50%;
    border: 1px solid currentColor;
    border-radius: 100px;
    padding: 10px 42px 10px 24px;
    font-size: 16px;
  }
`;
