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
    border: 2px solid var(--cg-color-outline-variant, #49454e);
    border-top-color: var(--cg-color-primary, #a8c7fa);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .pulse-spinner {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }
  .pulse-bar-spinner {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  :focus-visible {
    outline: 2px solid var(--cg-color-primary, #a8c7fa);
    outline-offset: 2px;
  }
`;
