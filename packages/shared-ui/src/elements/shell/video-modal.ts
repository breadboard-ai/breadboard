/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";

@customElement("bb-video-modal")
export class VEVideoModal extends LitElement {
  static styles = [
    type,
    colorsLight,
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
        --background: var(--n-0);
        --color: var(--n-100);
      }
    `,
  ];

  render() {
    return html`<bb-modal>
      <iframe
        width="100%"
        height="100%"
        src="https://www.youtube.com/embed/E0hrcDO3Noc"
        title="How to build an app"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
    </bb-modal>`;
  }
}
