/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css } from "lit";

/**
 * A Material 3 chip https://m3.material.io/components/chips/overview
 *
 * Example usage:
 *
 * ```html
 * <button class="bb-chip">
 *   <span class="g-icon">search_spark</span>
 *   <span>Research analyst</span>
 * </button>
 * ```
 *
 * The icon is optional, and can be moved to the other side of the chip by
 * changing its position in the parent.
 */
export const chipStyles = css`
  .bb-chip {
    display: inline-flex;
    align-items: center;
    border: none;
    font-size: 12px;
    border-radius: 100px;
    color: var(--bb-neutral-700);
    background: var(--bb-neutral-100);
    margin: 0 0.4167em;
    padding: 0.3333em 0.6667em;
    cursor: pointer;

    &:hover {
      filter: brightness(97%);
    }

    & > .g-icon {
      font-size: 1.6667em;
    }
    & > :nth-child(2) {
      margin-left: 0.3em;
    }
  }
`;
