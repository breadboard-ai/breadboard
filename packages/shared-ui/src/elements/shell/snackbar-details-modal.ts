/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { icons } from "../../styles/icons";

@customElement("bb-snackbar-details-modal")
export class VESnackbarDetailsModal extends LitElement {
  @property()
  accessor details: HTMLTemplateResult | string | null = null;

  static styles = [
    type,
    colorsLight,
    icons,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }

      section {
        width: 80svw;
        max-width: 540px;
      }

      h1,
      h2,
      p,
      li {
        margin: 0 0 var(--bb-grid-size-2) 0;
      }
    `,
  ];

  render() {
    return html`<bb-modal .modalTitle=${"Details"} .showCloseButton=${true}>
      <section>
        ${this.details ? this.details : html`<p>No details provided</p>`}
      </section>
    </bb-modal>`;
  }
}
