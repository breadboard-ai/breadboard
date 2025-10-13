/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, CSSResultGroup, unsafeCSS } from "lit";
import { grid } from "./shared.js";

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
    new Array(49)
      .fill(0)
      .map((_, index) => {
        const idx = index - 24;
        const lbl = idx < 0 ? `n${Math.abs(idx)}` : idx.toString();
        return `
        .layout-p-${lbl} { --padding: ${idx * grid}px; padding: var(--padding); }
        .layout-pt-${lbl} { padding-top: ${idx * grid}px; }
        .layout-pr-${lbl} { padding-right: ${idx * grid}px; }
        .layout-pb-${lbl} { padding-bottom: ${idx * grid}px; }
        .layout-pl-${lbl} { padding-left: ${idx * grid}px; }

        .layout-m-${lbl} { --margin: ${idx * grid}px; margin: var(--margin); }
        .layout-mt-${lbl} { margin-top: ${idx * grid}px; }
        .layout-mr-${lbl} { margin-right: ${idx * grid}px; }
        .layout-mb-${lbl} { margin-bottom: ${idx * grid}px; }
        .layout-ml-${lbl} { margin-left: ${idx * grid}px; }

        .layout-t-${lbl} { top: ${idx * grid}px; }
        .layout-r-${lbl} { right: ${idx * grid}px; }
        .layout-b-${lbl} { bottom: ${idx * grid}px; }
        .layout-l-${lbl} { left: ${idx * grid}px; }`;
      })
      .join("\n")
  )}

  ${unsafeCSS(
    new Array(25)
      .fill(0)
      .map((_, idx) => {
        return `
        .layout-g-${idx} { gap: ${idx * grid}px; }`;
      })
      .join("\n")
  )}

  ${unsafeCSS(
    new Array(8)
      .fill(0)
      .map((_, idx) => {
        return `
        .layout-grd-col${idx + 1} { grid-template-columns: ${"1fr ".repeat(idx + 1).trim()}; }`;
      })
      .join("\n")
  )}

  .layout-pos-a {
    position: absolute;
  }

  .layout-pos-rel {
    position: relative;
  }

  .layout-dsp-none {
    display: none;
  }

  .layout-dsp-block {
    display: block;
  }

  .layout-dsp-grid {
    display: grid;
  }

  .layout-dsp-iflex {
    display: inline-flex;
  }

  .layout-dsp-flexvert {
    display: flex;
    flex-direction: column;
  }

  .layout-dsp-flexhor {
    display: flex;
    flex-direction: row;
  }

  .layout-fw-w {
    flex-wrap: wrap;
  }

  .layout-al-fs {
    align-items: flex-start;
  }

  .layout-al-c {
    align-items: center;
  }

  .layout-as-n {
    align-self: normal;
  }

  .layout-js-c {
    justify-self: center;
  }

  .layout-sp-c {
    justify-content: center;
  }

  .layout-sp-ev {
    justify-content: space-evenly;
  }

  .layout-sp-bt {
    justify-content: space-between;
  }

  .layout-r-none {
    resize: none;
  }

  .layout-fs-c {
    field-sizing: content;
  }

  .layout-fs-n {
    field-sizing: none;
  }

  .layout-flx-0 {
    flex: 0 0 auto;
  }

  .layout-flx-1 {
    flex: 1 0 auto;
  }

  .layout-c-s {
    contain: strict;
  }

  /** Widths **/

  ${unsafeCSS(
    new Array(10)
      .fill(0)
      .map((_, idx) => {
        const weight = (idx + 1) * 10;
        return `.layout-w-${weight} { width: ${weight}%; max-width: ${weight}%; }`;
      })
      .join("\n")
  )}

  ${unsafeCSS(
    new Array(16)
      .fill(0)
      .map((_, idx) => {
        const weight = idx * grid;
        return `.layout-wp-${idx} { width: ${weight}px; }`;
      })
      .join("\n")
  )}

  /** Heights **/

  ${unsafeCSS(
    new Array(10)
      .fill(0)
      .map((_, idx) => {
        const height = (idx + 1) * 10;
        return `.layout-h-${height} { height: ${height}%; }`;
      })
      .join("\n")
  )}

  ${unsafeCSS(
    new Array(16)
      .fill(0)
      .map((_, idx) => {
        const height = idx * grid;
        return `.layout-hp-${idx} { height: ${height}px; }`;
      })
      .join("\n")
  )}

  .layout-el-cv {
    & img,
    & video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      margin: 0;
    }
  }

  .layout-ar-sq {
    aspect-ratio: 1 / 1;
  }

  .layout-ex-fb {
    margin: calc(var(--padding) * -1) 0 0 calc(var(--padding) * -1);
    width: calc(100% + var(--padding) * 2);
    height: calc(100% + var(--padding) * 2);
  }
` as CSSResultGroup;
