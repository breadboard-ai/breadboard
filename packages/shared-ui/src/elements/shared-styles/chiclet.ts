/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const styles = css`
  .chiclet {
    cursor: pointer;
    display: inline-flex;
    padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-6);
    background: var(--bb-neutral-50);
    outline: 1px solid var(--bb-neutral-100);
    color: var(--bb-neutral-700);
    border-radius: var(--bb-grid-size-16);
    border: none;
    height: var(--bb-grid-size-5);
    caret-color: transparent;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    user-select: none;
    white-space: nowrap;
    font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
      var(--bb-font-family);

    & * {
      caret-color: transparent;
      &::selection {
        background: none;
      }
    }

    & span {
      display: none;

      &.visible {
        display: inline;
        pointer-events: none;
      }
    }

    &.in {
      background: var(--bb-input-50) var(--bb-icon-output) 5px center / 16px
        16px no-repeat;
      outline: 1px solid var(--bb-input-100);
      color: var(--bb-input-700);
    }

    &.asset {
      background: var(--bb-asset-50) var(--bb-icon-text) 5px center / 16px 16px
        no-repeat;
      outline: 1px solid var(--bb-asset-100);
      color: var(--bb-asset-700);
    }

    &.audio {
      background-image: var(--bb-icon-sound);
    }

    &.video {
      background-image: var(--bb-icon-add-video);
    }

    &.text {
      background-image: var(--bb-icon-text);
    }

    &.image {
      background-image: var(--bb-icon-add-image);
    }

    &.tool {
      background: var(--bb-tool-50) var(--bb-icon-home-repair-service) 5px
        center / 16px 16px no-repeat;
      outline: 1px solid var(--bb-tool-100);
      color: var(--bb-tool-700);
    }

    &.param {
      background: var(--bb-param-50) var(--bb-icon-contact-support) 5px center /
        16px 16px no-repeat;
      outline: 1px solid var(--bb-param-100);
      color: var(--bb-param-700);
    }

    &.selected {
      background-color: var(--bb-ui-500);
      outline: 1px solid var(--bb-ui-700);
      color: var(--bb-neutral-0);
    }

    &.invalid {
      background-color: var(--bb-warning-100);
      outline: 1px solid var(--bb-warning-200);
      color: var(--bb-warning-700);
    }
  }
` as CSSResultGroup;
