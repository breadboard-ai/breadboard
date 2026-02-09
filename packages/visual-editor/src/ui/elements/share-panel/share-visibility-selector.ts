/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../styles/icons.js";

export type VisibilityLevel = "only-you" | "restricted" | "anyone";

@customElement("bb-share-visibility-selector")
export class ShareVisibilitySelector extends LitElement {
  static styles = [
    icons,
    css`
      :host {
        display: block;
        margin-top: var(--bb-grid-size-6);
      }

      #container {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-3);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4)
          var(--bb-grid-size-3) 0;
        border-radius: var(--bb-grid-size-3);
      }

      #icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        flex-shrink: 0;
        background: #e8eaed;
        color: #5f6368;

        &.anyone {
          background: #c4fcd4;
          color: #188038;
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
        width: fit-content;
        cursor: pointer;
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
        border-radius: var(--bb-grid-size-2);
        margin-left: calc(-1 * var(--bb-grid-size-2));

        &:hover {
          background: var(--light-dark-n-90);
        }
      }

      #select-row .g-icon {
        font-size: 18px;
        color: var(--sys-color--on-surface);
      }

      #label {
        font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        color: var(--sys-color--on-surface);
      }

      select {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }

      #subtitle {
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        color: var(--light-dark-n-40);
      }
    `,
  ];

  @property()
  accessor value: VisibilityLevel = "only-you";

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
            <select .value=${this.value} @change=${this.#onChange}>
              <option value="only-you">Only you</option>
              <option value="restricted">Restricted</option>
              <option value="anyone">Anyone with link can view</option>
            </select>
          </div>
          <span id="subtitle">${subtitle}</span>
        </div>
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

  #onChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.value = select.value as VisibilityLevel;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-visibility-selector": ShareVisibilitySelector;
  }
}
