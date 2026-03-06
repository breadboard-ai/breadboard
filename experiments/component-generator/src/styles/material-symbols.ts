/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared CSS for Material Symbols Outlined icons inside shadow DOM.
 *
 * The `@font-face` is loaded globally via a Google Fonts `<link>` in
 * `index.html`, but the `.material-symbols-outlined` class rule from
 * Google's stylesheet doesn't pierce shadow boundaries. Import this
 * and spread it into any Lit component's `static styles` array:
 *
 * ```ts
 * static override styles = [materialSymbols, css`...`];
 * ```
 */

import { css } from "lit";

export { materialSymbols };

const materialSymbols = css`
  .material-symbols-outlined {
    font-family: "Material Symbols Outlined";
    font-weight: normal;
    font-style: normal;
    font-size: 20px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-smoothing: antialiased;
  }
`;
