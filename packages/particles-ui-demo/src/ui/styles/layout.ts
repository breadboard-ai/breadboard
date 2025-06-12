/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";
import { grid } from "./shared";

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
        .layout-p-${idx} { padding: ${idx * grid}px; }
        .layout-pt-${idx} { padding-top: ${idx * grid}px; }
        .layout-pr-${idx} { padding-right: ${idx * grid}px; }
        .layout-pb-${idx} { padding-bottom: ${idx * grid}px; }
        .layout-pl-${idx} { padding-left: ${idx * grid}px; }

        .layout-m-${idx} { margin: ${idx * grid}px; }
        .layout-mt-${idx} { margin-top: ${idx * grid}px; }
        .layout-mr-${idx} { margin-right: ${idx * grid}px; }
        .layout-mb-${idx} { margin-bottom: ${idx * grid}px; }
        .layout-ml-${idx} { margin-left: ${idx * grid}px; }

        .layout-t-${idx} { top: ${idx * grid}px; }
        .layout-r-${idx} { right: ${idx * grid}px; }
        .layout-b-${idx} { bottom: ${idx * grid}px; }
        .layout-l-${idx} { left: ${idx * grid}px; }`;
      })
      .join("\n")
  )}

  .layout-pos-a {
    position: absolute;
  }

  .layout-pos-rel {
    position: relative;
  }

  .layout-flx-vert {
    display: flex;
    flex-direction: column;
  }

  .layout-flx-hor {
    display: flex;
    flex-direction: row;
  }

  .layout-sp-ev {
    justify-content: space-evenly;
  }

  .layout-r-none {
    resize: none;
  }

  .layout-fs-c {
    field-sizing: content;
  }

  .layout-el-cv {
    width: 100%;
    height: 100%;
    object-fit: cover;
    margin: 0;
  }
` as CSSResultGroup;
