/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../styles/icons.js";

import type { VisibilityLevel } from "../../../sca/controller/subcontrollers/editor/share-controller.js";
export type { VisibilityLevel };

@customElement("bb-share-visibility-selector")
export class ShareVisibilitySelector extends LitElement {
  static styles = [
    icons,
    css`
      :host {
        display: block;
        margin-top: var(--bb-grid-size-3);
      }

      #container {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-3) 0 0 0;
        border-radius: var(--bb-grid-size-3);
      }

      #icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
        background: #e2e2e2;
        color: #1b1b1b;

        &.anyone {
          background: #c4fcd4;
          color: #00381f;
        }

        .g-icon {
          font-size: 20px;
          font-variation-settings:
            "FILL" 1,
            "wght" 600,
            "GRAD" 0,
            "opsz" 48;
        }
      }

      #text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      #select-row {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: var(--bb-grid-size-3);
        width: fit-content;
        cursor: pointer;
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
        border-radius: var(--bb-grid-size-2);
        margin-left: calc(-1 * var(--bb-grid-size-2));

        &:hover {
          background: #f1f1f1;
        }
      }

      #select-row .g-icon {
        font-size: 18px;
        color: var(--sys-color--on-surface);
      }

      #label {
        color: #525252;
        font-family: var(--bb-font-family-flex);
        font-size: 14px;
        font-weight: 500;
        line-height: 16px;
      }

      select {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }

      #edit-access-button {
        margin-left: auto;
        padding: 10px 16px;
        border-radius: 100px;
        background: #1b1b1b;
        color: #fff;
        font-family: var(--bb-font-family-flex);
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        letter-spacing: 0;
        border: none;
        cursor: pointer;
        white-space: nowrap;

        &:hover {
          background: #3c3c3c;
        }
      }

      #subtitle {
        color: #525252;
        font-family: var(--bb-font-family-flex);
        font-size: 12px;
        font-weight: 300;
        line-height: 16px;
      }

      .spinner {
        animation: rotate 1s linear infinite;
        margin-left: auto;
        flex-shrink: 0;
      }

      @keyframes rotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      select:disabled {
        cursor: wait;
      }

      :host([loading]) #select-row {
        pointer-events: none;
        opacity: 0.6;
      }
    `,
  ];

  @property()
  accessor value: VisibilityLevel = "only-you";

  @property({ type: Boolean, reflect: true })
  accessor loading = false;

  render() {
    const { icon, label, subtitle } = this.#iconAndSubtitle();

    return html`
      <div id="container">
        <div id="icon" class=${this.value === "anyone" ? "anyone" : ""}>
          <span class="g-icon">${icon}</span>
        </div>
        <div id="text">
          <div id="select-row">
            <span id="label">${label}</span>
            <span class="g-icon">arrow_drop_down</span>
            <select
              .value=${this.value}
              @change=${this.#onChange}
              ?disabled=${this.loading}
            >
              <option value="only-you">Only you</option>
              <option value="restricted">Restricted</option>
              <option value="anyone">Anyone with the link</option>
            </select>
          </div>
          <span id="subtitle">${subtitle}</span>
        </div>
        ${this.loading
          ? html`<span class="g-icon spinner">progress_activity</span>`
          : this.value === "restricted"
            ? html`
                <button id="edit-access-button" @click=${this.#onEditAccess}>
                  Edit access
                </button>
              `
            : nothing}
      </div>
    `;
  }

  #iconAndSubtitle(): { icon: string; label: string; subtitle: string } {
    const value = this.value;
    if (value === "anyone") {
      return {
        icon: "public",
        label: "Anyone with the link",
        subtitle: "Anyone on the internet with the link can view",
      };
    } else if (value === "restricted") {
      return {
        icon: "lock",
        label: "Restricted",
        subtitle: "Only people with access can open with the link",
      };
    } else if (value === "only-you") {
      return {
        icon: "lock",
        label: "Only you",
        subtitle: "Only you can open this link",
      };
    }
    value satisfies never;
    return { icon: "lock", label: "", subtitle: "" };
  }

  #onEditAccess() {
    this.dispatchEvent(
      new Event("edit-access", { bubbles: true, composed: true })
    );
  }

  #onChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.value = select.value as VisibilityLevel;
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-visibility-selector": ShareVisibilitySelector;
  }
}
