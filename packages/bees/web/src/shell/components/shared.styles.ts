/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

export const sharedStyles = css`
  /* Shared Spinner */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--cg-color-outline-variant, #e0ddd9);
    border-top-color: var(--cg-color-primary, #3b5fc0);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;
