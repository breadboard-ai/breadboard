/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { icons } from "../../styles/icons.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";

@customElement("bb-publish-button")
export class PublishButton extends LitElement {
  static styles = [
    icons,
    baseColors,
    type,
    css`
      :host {
        display: block;
      }

      button {
        display: flex;
        align-items: center;
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-80);
        border-radius: var(--bb-grid-size-16);
        color: var(--light-dark-n-0);
        height: var(--bb-grid-size-8);
        padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-3);
        font-size: 14px;
        transition: border 0.2s cubic-bezier(0, 0, 0.2, 1);
        cursor: pointer;
        opacity: 1;
        position: relative;

        & .g-icon {
          margin-right: var(--bb-grid-size-2);
          font-size: 20px;
        }

        &::after {
          content: "";
          position: absolute;
          width: 8px;
          height: 8px;
          background: #a80710;
          border-radius: 50%;
          top: -2px;
          right: -2px;
          border: 1px solid var(--light-dark-n-100);
        }

        &:hover {
          border: 1px solid var(--light-dark-n-50);
        }

        &:disabled {
          opacity: 0.5;
          cursor: auto;
        }
      }
    `,
  ];

  render() {
    return html`
      <button
        class="sans-flex round w-500"
        @click=${() => {
        console.log("Publish clicked");
      }}
      >
        <span class="g-icon">cloud_done</span>
        Publish
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-publish-button": PublishButton;
  }
}
