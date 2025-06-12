/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { styles } from "../styles/default.js";

@customElement("ui-hero-image")
export class HeroImage extends LitElement {
  static styles = [
    styles,
    css`
      :host {
        display: block;
      }

      section {
        display: grid;
        height: 100%;
      }
    `,
  ];

  render() {
    return html`<section class="layout-pos-rel">
      <slot name="hero"></slot>
      <slot name="headline"></slot>
    </section>`;
  }
}
