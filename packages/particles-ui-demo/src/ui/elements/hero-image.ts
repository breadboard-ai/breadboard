/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as ParticlesUI from "@breadboard-ai/particles-ui";

@customElement("ui-hero-image")
export class UIHeroImage extends LitElement {
  @property({ reflect: true, type: String })
  accessor containerOrientation: ParticlesUI.Particles.Orientation | null =
    null;

  static styles = [
    ParticlesUI.Styles.all,
    css`
      :host {
        display: block;
        overflow: hidden;
      }

      section {
        display: grid;
        height: 100%;
      }

      :host([containerorientation="vertical"]) {
        ::slotted(img) {
          aspect-ratio: 16/9;
          max-height: 400px;
        }
      }

      :host([containerorientation="horizontal"]) {
        ::slotted(img) {
          aspect-ratio: 1/1;
        }
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
