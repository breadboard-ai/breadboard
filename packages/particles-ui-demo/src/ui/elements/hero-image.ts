/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { styles } from "../styles";
import { customElement, property } from "lit/decorators.js";
import { Orientation } from "../../types/particles";

@customElement("ui-hero-image")
export class UIHeroImage extends LitElement {
  @property({ reflect: true, type: String })
  accessor containerOrientation: Orientation | null = null;

  static styles = [
    styles,
    css`
      :host {
        display: block;
        overflow: hidden;
      }

      section {
        display: grid;
        height: 100%;
      }

      ::slotted(img),
      ::slotted(video) {
        max-height: 400px;
      }

      :host([containerorientation="vertical"])::slotted(img) {
        aspect-ratio: 16/9;
      }

      :host([containerorientation="horizontal"])::slotted(img) {
        aspect-ratio: 1/1;
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
