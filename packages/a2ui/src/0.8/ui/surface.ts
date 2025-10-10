/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SurfaceID, Surface as SurfaceState } from "../types/types";
import { A2UIModelProcessor } from "../data/model-processor";

@customElement("a2ui-surface")
export class Surface extends LitElement {
  @property()
  accessor surfaceId: SurfaceID | null = null;

  @property()
  accessor surface: SurfaceState | null = null;

  @property()
  accessor processor: A2UIModelProcessor | null = null;

  static styles = css`
    :host {
      display: flex;
      min-height: 0;
      overflow: auto;
      max-height: 100%;
    }
  `;

  render() {
    if (!this.surface) {
      return nothing;
    }

    return html`<a2ui-root
      .surfaceId=${this.surfaceId}
      .processor=${this.processor}
      .childComponents=${[this.surface.componentTree]}
    ></a2ui-root>`;
  }
}
