/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
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

      #wrapper {
        position: relative;
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

      #tooltip {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        background: #2e2e2e;
        color: #f2f2f2;
        font-family: var(--bb-font-family-flex);
        font-size: 12px;
        font-weight: 400;
        line-height: 16px;
        letter-spacing: 0.1px;
        padding: 8px 12px;
        border-radius: 4px;
        width: 230px;
        white-space: normal;
        opacity: 0;
        transition: opacity 0.15s ease 0.5s;
        pointer-events: none;

        .up-to-date {
          display: flex;
          align-items: center;
          gap: 6px;

          & .g-icon {
            font-size: 24px;
            flex-shrink: 0;
            --icon-wght: 500;
          }
        }

        .last-published {
          margin-bottom: 8px;
        }
      }

      /* Bridges the gap so the cursor can move into the tooltip. */
      #wrapper:hover #tooltip::before {
        content: "";
        position: absolute;
        top: -8px;
        left: 0;
        right: 0;
        height: 8px;
      }

      #wrapper:hover #tooltip {
        opacity: 1;
        pointer-events: auto;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .spinner {
        animation: spin 1s linear infinite;
        color: #575b5f;
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
      <div id="wrapper">
        <button
          class=${classMap({
            "sans-flex": true,
            round: true,
            "w-500": true,
            "has-red-dot": !!this.#share?.stale,
          })}
          ?disabled=${!this.#isEnabled}
          @click=${this.#onClickPublish}
        >
          <span
            class=${classMap({
              "g-icon": true,
              spinner: this.#isPublishing,
            })}
            >${this.#icon}</span
          >
          ${this.#label}
        </button>
        <span id="tooltip">${this.#renderTooltip()}</span>
      </div>
    `;
  }

  #renderTooltip() {
    if (this.#share?.visibility === "only-you") {
      return html`You can't publish your Opal because it isn't shared yet.`;
    }
    if (this.#share?.stale) {
      return [
        this.#renderLastPublished(),
        html`Click publish to update your Opal. This ensures everyone with your
        shared link sees your latest changes.`,
      ];
    }
    return [
      this.#renderLastPublished(),
      html`<span class="up-to-date">
        <span
          >Your Opal is up-to-date. Everyone with your shared link sees your
          latest changes.</span
        >
        <span class="g-icon">check</span>
      </span>`,
    ];
  }

  #renderLastPublished() {
    const iso = this.#share?.lastPublishedIso;
    if (!iso) {
      return nothing;
    }
    const formatted = new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return html`<div class="last-published">Last Published: ${formatted}</div>`;
  }

  get #isEnabled() {
    const share = this.#share;
    return share?.stale && share?.panel === "closed" && !this.#isPublishing;
  }

  get #isPublishing() {
    return this.#share?.status === "publishing-stale";
  }

  get #label() {
    return this.#isPublishing ? "Publishing" : "Publish";
  }

  get #icon() {
    return this.#isPublishing ? "progress_activity" : "cloud_upload";
  }

  async #onClickPublish() {
    if (this.#isEnabled) {
      await this.sca.actions.share.publishStale();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-publish-button": PublishButton;
  }
}
