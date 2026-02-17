/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";

@customElement("bb-publish-button")
export class PublishButton extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    baseColors,
    type,
    css`
      :host {
        display: flex;
        justify-content: flex-end;
        width: 130px;
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
          border-radius: 50%;
          top: -2px;
          right: -2px;
          border: 1px solid var(--light-dark-n-100);
          display: none;
        }

        &.has-red-dot::after {
          display: block;
          background: #a80710;
        }

        &:hover:not(:disabled) {
          border: 1px solid var(--light-dark-n-50);
        }

        &:disabled {
          opacity: 0.5;
          cursor: auto;
        }
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .spinner {
        animation: spin 1s linear infinite;
        color: #575B5F;
      }
    `,
  ];

  @consume({ context: scaContext })
  accessor sca!: SCA;

  get #share() {
    return this.sca?.controller?.editor?.share;
  }

  render() {
    return html`
      <button
        class=${classMap({
          "sans-flex": true,
          round: true,
          "w-500": true,
          "has-red-dot": this.#hasRedDot,
        })}
        ?disabled=${this.#isDisabled}
      >
        <span class=${classMap({
          "g-icon": true,
          spinner: this.#isPublishing,
        })}>${this.#icon}</span>
        ${this.#label}
      </button>
    `;
  }

  get #hasRedDot() {
    const share = this.#share;
    return share?.published && share?.stale;
  }

  get #isDisabled() {
    const share = this.#share;
    return !share?.published || !share?.stale;
  }

  get #isPublishing() {
    return this.#share?.panel === "updating";
  }

  get #label() {
    return this.#isPublishing ? "Publishing" : "Publish";
  }

  get #icon() {
    return this.#isPublishing ? "progress_activity" : "cloud_upload";
  }

}

declare global {
  interface HTMLElementTagNameMap {
    "bb-publish-button": PublishButton;
  }
}
