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
        color: var(--opal-color-on-surface-strong);
        font-family: var(--opal-font-display);
        font-size: var(--opal-headline-small-size);
        font-weight: var(--opal-headline-small-weight);
        line-height: var(--opal-headline-small-line-height);
        font-variation-settings: var(--opal-headline-small-font-variation);
      }

      section {
        display: flex;
        align-items: center;
        gap: var(--opal-grid-2);
      }

      aside {
        color: var(--opal-color-on-surface-strong);
        text-align: center;
        font-family: var(--opal-font-text);
        font-size: var(--opal-label-medium-size);
        font-weight: var(--opal-label-medium-weight);
        line-height: var(--opal-label-medium-line-height);
        text-transform: uppercase;
        border-radius: var(--opal-radius-pill);
        border: 1px solid var(--opal-color-on-surface-strong);
        padding: 0 var(--opal-grid-2);
      }
    `,
  ];

  render() {
    return html`
      <section>
        <h1>${msg("Folio")}</h1>
        <aside>${msg("Experiment")}</aside>
      </section>
      <o-shell-theme-selector></o-shell-theme-selector>
    `;
  }
}
