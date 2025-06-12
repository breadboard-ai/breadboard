/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";

export const grid = 4;

export const layout = css`
  :host {
    ${unsafeCSS(
      new Array(16)
        .fill(0)
        .map((_, idx) => {
          return `--g-${idx + 1}: ${(idx + 1) * grid}px;`;
        })
        .join("\n")
    )}
  }

  ${unsafeCSS(
    new Array(17)
      .fill(0)
      .map((_, idx) => {
        return `
        .border-radius-${idx} { border-radius: ${idx * grid}px; }

        .padding-${idx} { padding: ${idx * grid}px; }
        .padding-top-${idx} { padding-top: ${idx * grid}px; }
        .padding-right-${idx} { padding-right: ${idx * grid}px; }
        .padding-bottom-${idx} { padding-bottom: ${idx * grid}px; }
        .padding-left-${idx} { padding-left: ${idx * grid}px; }

        .margin-${idx} { margin: ${idx * grid}px; }
        .margin-top-${idx} { margin-top: ${idx * grid}px; }
        .margin-right-${idx} { margin-right: ${idx * grid}px; }
        .margin-bottom-${idx} { margin-bottom: ${idx * grid}px; }
        .margin-left-${idx} { margin-left: ${idx * grid}px; }

        .top-${idx} { top: ${idx * grid}px; }
        .right-${idx} { right: ${idx * grid}px; }
        .bottom-${idx} { bottom: ${idx * grid}px; }
        .left-${idx} { left: ${idx * grid}px; }`;
      })
      .join("\n")
  )}

  .position-absolute {
    position: absolute;
  }

  .position-relative {
    position: relative;
  }

  .flex-vertical {
    display: flex;
    flex-direction: column;
  }

  .flex-horizontal {
    display: flex;
    flex-direction: horizontal;
  }

  .space-evenly {
    justify-content: space-evenly;
  }

  .resize-none {
    resize: none;
  }

  .field-sizing-content {
    field-sizing: content;
  }

  .cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    margin: 0;
  }
` as CSSResultGroup;
