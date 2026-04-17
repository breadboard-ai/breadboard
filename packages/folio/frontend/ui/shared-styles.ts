/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { css } from "lit";

export const sharedStyles = css`
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    margin: 0;
    font-family: var(--opal-font-headline);
  }

  h1,
  h2,
  h3,
  h4,
  h5 {
    color: var(--opal-color-on-surface);
  }

  h1 {
    font-size: var(--opal-headline-large-size);
    font-weight: var(--opal-headline-large-weight);
    line-height: var(--opal-headline-large-line-height);
    font-feature-settings: var(--opal-headline-large-font-feature);
  }

  h2 {
    font-size: var(--opal-title-large-size);
    font-weight: var(--opal-title-large-weight);
    line-height: var(--opal-title-large-line-height);
    font-feature-settings: var(--opal-title-large-font-feature);
  }

  h3 {
    font-size: var(--opal-title-medium-size);
    font-weight: var(--opal-title-medium-weight);
    line-height: var(--opal-title-medium-line-height);
    font-feature-settings: var(--opal-title-medium-font-feature);
  }

  h4 {
    font-size: var(--opal-label-large-size);
    font-weight: var(--opal-label-large-weight);
    line-height: var(--opal-label-large-line-height);
    font-feature-settings: var(--opal-label-large-font-feature);
  }

  h5 {
    font-size: var(--opal-label-medium-size);
    font-weight: var(--opal-label-medium-weight);
    line-height: var(--opal-label-medium-line-height);
  }

  p {
    font-size: var(--opal-body-large-size);
    font-weight: var(--opal-body-large-weight);
    line-height: var(--opal-body-large-line-height);
    font-feature-settings: var(--opal-body-large-font-feature);
  }

  button {
    display: flex;
    height: var(--opal-height-control);
    padding: 0 var(--opal-grid-6);
    justify-content: center;
    align-items: center;
    gap: var(--opal-grid-2);
    border-radius: var(--opal-radius-pill);
    background: var(--opal-color-interactive-surface);
    color: var(--opal-color-on-surface);
    border: none;
    cursor: pointer;
    font-family: var(--opal-font-text);
    font-size: var(--opal-label-medium-size);
    font-weight: var(--opal-label-medium-weight);
    transition:
      background 0.2s ease,
      color 0.2s ease;

    &:has(.g-icon) {
      padding: 0 24px 0 16px;
    }

    &.secondary {
      background: var(--opal-color-surface);
      border: 1px solid var(--opal-color-border-subtle);
    }

    &.filter {
      border-radius: var(--opal-radius-8);
      background: var(--opal-color-surface-tinted);
      color: var(--opal-color-on-surface-strong);
      padding: 0 var(--opal-grid-4);
      height: var(--opal-height-control-small);
      font-size: var(--opal-label-small-size);
    }

    &.filter.selected {
      background: var(--opal-color-on-surface-strong);
      color: var(--opal-color-surface);
    }

    &.agent {
      background: var(--agent-color, var(--opal-color-interactive-surface));
      color: var(--agent-text-color, var(--opal-color-on-surface));
    }
  }
`;
