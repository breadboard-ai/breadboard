/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import "./shell-theme-selector.js";

@localized()
@customElement("o-shell-header")
export class ShellHeader extends LitElement {
  static styles = [
    css`
      :host {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: var(--opal-grid-10);
        padding: var(--opal-grid-4) var(--opal-grid-6);
      }
      h1 {
        margin: 0;
        color: var(--opal-color-header-foreground);
        font-family: var(--opal-font-display);
        font-size: var(--opal-font-size-header);
        font-weight: var(--opal-font-weight-header);
        line-height: var(--opal-line-height-header);
      }
    `,
  ];

  render() {
    return html`
      <h1>${msg("Folio")}</h1>
      <o-shell-theme-selector></o-shell-theme-selector>
    `;
  }
}
