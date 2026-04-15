/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";

export const sharedStyles = css`
  h1 {
    color: var(--opal-color-on-surface);
    font-family: var(--opal-font-headline);
    font-size: var(--opal-headline-large-size);
    font-weight: var(--opal-headline-large-weight);
    line-height: var(--opal-headline-large-line-height);
    font-feature-settings: var(--opal-headline-large-font-feature);
    margin: 0;
  }

  p {
    color: var(--opal-color-on-surface-variant);
    font-family: var(--opal-font-headline);
    font-size: var(--opal-body-large-size);
    font-weight: var(--opal-body-large-weight);
    line-height: var(--opal-body-large-line-height);
    font-feature-settings: var(--opal-body-large-font-feature);
    margin: 0;
  }

  button {
    display: flex;
    height: var(--opal-grid-10);
    padding: 0 var(--opal-grid-6);
    justify-content: center;
    align-items: center;
    gap: var(--opal-grid-2);
    border-radius: var(--opal-radius-pill);
    background: var(--opal-color-button-background);
    color: var(--opal-color-on-surface);
    border: none;
    cursor: pointer;
    font-family: var(--opal-font-text);
    font-size: var(--opal-label-medium-size);
    font-weight: var(--opal-label-medium-weight);
  }
`;
