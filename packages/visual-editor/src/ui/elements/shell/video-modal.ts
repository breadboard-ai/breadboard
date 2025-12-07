/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";

@customElement("bb-video-modal")
export class VEVideoModal extends LitElement {
  static styles = [
    type,
    baseColors,
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

      iframe {
        border-radius: var(--bb-grid-size-4);
        width: 80svw;
        max-width: 860px;
        aspect-ratio: 16/9;
      }

      bb-modal {
        --background: var(--light-dark-n-0);
        --color: var(--light-dark-n-100);
      }
    `,
  ];

  render() {
    return html`<bb-modal>
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/NWNNDvehBIU"
        title="How to build an app"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
    </bb-modal>`;
  }
}
