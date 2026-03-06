/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `<cg-sidebar>` — Left sidebar containing the component library.
 *
 * Stripped down to just `<cg-library>`. Generation form lives in the
 * generation overlay; settings live in the settings overlay.
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import "./cg-library.js";

@customElement("cg-sidebar")
export class CgSidebar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      background: var(--host-surface-1);
      border-right: 1px solid var(--host-border);
      overflow: hidden;
    }

    cg-library {
      flex: 1;
      min-height: 0;
    }
  `;

  override render() {
    return html`<cg-library></cg-library>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cg-sidebar": CgSidebar;
  }
}
