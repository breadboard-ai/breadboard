/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup } from "lit";

export const details = css`
  .output {
    position: relative;
    margin-top: var(--bb-grid-size-7);
    border-radius: var(--bb-grid-size-2);
    padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
    border: 1px solid var(--bb-neutral-200);
    color: var(--bb-neutral-900);
    font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
      var(--bb-font-family);
    display: flex;
    align-items: center;
    justify-content: center;

    > * {
      max-width: 800px;
      width: 100%;

      &:last-of-type {
        margin-bottom: 0;
      }
    }

    &::before {
      content: "Output:";
      position: absolute;
      left: var(--bb-grid-size-3);
      top: calc(var(--bb-grid-size-5) * -1);
      color: var(--bb-neutral-500);
    }

    & p {
      margin: 0;
    }
  }

  details {
    margin: 0 0 var(--bb-grid-size-4) 0;

    summary {
      display: flex;
      align-items: center;
      height: var(--bb-grid-size-9);
      border-radius: var(--bb-grid-size-3);
      list-style: none;
      padding: 0 var(--bb-grid-size-3);
      background: var(--bb-neutral-50);
      color: var(--bb-neutral-900);
      font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      cursor: pointer;

      &.input,
      &.chat_mirror {
        background: var(--bb-ui-100);
      }

      > * {
        pointer-events: none;
        user-select: none;
      }

      &::-webkit-details-marker {
        display: none;
      }

      & .title {
        display: flex;
        align-items: center;
        flex: 1 1 auto;

        & .g-icon {
          margin-left: var(--bb-grid-size);
          animation: rotate 1s linear forwards infinite;
        }

        & .duration {
          color: var(--bb-neutral-700);
          margin-left: var(--bb-grid-size);
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
        }
      }

      & .g-icon {
        flex: 0 0 auto;

        &.step-icon {
          margin-right: var(--bb-grid-size-2);
        }

        &.details-status::before {
          content: "keyboard_arrow_up";
        }
      }
    }

    &[open] > summary {
      margin-bottom: var(--bb-grid-size-3);

      & .g-icon.details-status::before {
        content: "keyboard_arrow_down";
      }
    }

    & .products {
      list-style: none;
      padding: 0;
      margin: 0;
    }
  }
` as CSSResultGroup;
