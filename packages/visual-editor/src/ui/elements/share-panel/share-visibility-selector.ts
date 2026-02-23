/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { VisibilityLevel } from "../../../sca/controller/subcontrollers/editor/share-controller.js";
import { icons } from "../../styles/icons.js";

interface Option {
  level: VisibilityLevel;
  label: string;
  icon: string;
  subtitle: string;
}

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

        &.icon-public {
          background: #c4fcd4;
          color: #00381f;
        }

        &.icon-domain {
          background: #c2e7ff;
          color: #004a77;
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
        /* Reset button defaults */
        font: inherit;
        color: inherit;
        background: none;
        border: none;

        position: relative;
        display: inline-flex;
        align-items: center;
        gap: var(--bb-grid-size-3);
        width: fit-content;
        cursor: pointer;
        padding: var(--bb-grid-size) var(--bb-grid-size-2);
        border-radius: var(--bb-grid-size-2);
        margin-left: calc(-1 * var(--bb-grid-size-2));

        &:hover:not(:disabled) {
          background: #f1f1f1;
        }

        &:disabled {
          pointer-events: none;
          opacity: 0.6;
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

      #dropdown {
        /* Override popover UA defaults */
        position: fixed;
        inset: unset;
        margin: 0;
        border: none;
        color: inherit;

        z-index: 1000;
        min-width: 220px;
        background: #fff;
        border-radius: 12px;
        box-shadow:
          0 2px 6px rgba(0, 0, 0, 0.15),
          0 8px 24px rgba(0, 0, 0, 0.12);
        padding: var(--bb-grid-size-2) 0;
      }

      .dropdown-option {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size-3);
        padding: 10px 16px;
        cursor: pointer;
        font-family: var(--bb-font-family-flex);
        font-size: 14px;
        font-weight: 400;
        color: #1b1b1b;
        border: none;
        background: none;
        width: 100%;
        text-align: left;

        &:hover {
          background: #f5f5f5;
        }
      }

      .check-icon {
        width: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .check-icon .g-icon {
        font-size: 20px;
        color: #1a73e8;
        font-variation-settings:
          "FILL" 0,
          "wght" 600,
          "GRAD" 0,
          "opsz" 48;
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
    `,
  ];

  @property()
  accessor value: VisibilityLevel = "only-you";

  @property({ type: Boolean })
  accessor domainRestricted = false;

  @property({ type: Boolean, reflect: true })
  accessor loading = false;

  readonly #triggerRef = createRef<HTMLButtonElement>();
  readonly #dropdownRef = createRef<HTMLDivElement>();

  get #options(): Option[] {
    return [
      {
        level: "only-you",
        label: "Only you",
        icon: "lock",
        subtitle: "Only you can open this link",
      },
      {
        level: "restricted",
        label: "Restricted",
        icon: "lock",
        subtitle: "Only people with access can open with the link",
      },
      this.domainRestricted
        ? {
            level: "anyone",
            label: "Your Organization",
            icon: "domain",
            subtitle: "Anyone in your organization with the link can view",
          }
        : {
            level: "anyone",
            label: "Anyone with the link",
            icon: "public",
            subtitle: "Anyone on the internet with the link can view",
          },
    ];
  }

  render() {
    const opt = this.#options.find((o) => o.level === this.value)!;

    return html`
      <div id="container">
        <div id="icon" class="icon-${opt.icon}">
          <span class="g-icon">${opt.icon}</span>
        </div>
        <div id="text">
          <button
            id="select-row"
            ${ref(this.#triggerRef)}
            type="button"
            popovertarget="dropdown"
            ?disabled=${this.loading}
          >
            <span id="label">${opt.label}</span>
            <span class="g-icon">arrow_drop_down</span>
          </button>
          <span id="subtitle">${opt.subtitle}</span>
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
      <div
        id="dropdown"
        ${ref(this.#dropdownRef)}
        popover="auto"
        @beforetoggle=${this.#onBeforeToggle}
      >
        ${this.#options.map(
          (opt) => html`
            <button
              class="dropdown-option"
              @click=${() => this.#selectOption(opt.level)}
            >
              <span class="check-icon">
                ${opt.level === this.value
                  ? html`<span class="g-icon">check</span>`
                  : nothing}
              </span>
              ${opt.label}
            </button>
          `
        )}
      </div>
    `;
  }

  /** Position the dropdown below the trigger before it becomes visible. */
  #onBeforeToggle(event: ToggleEvent) {
    if (event.newState !== "open") {
      return;
    }
    const trigger = this.#triggerRef.value;
    const dropdown = this.#dropdownRef.value;
    if (!trigger || !dropdown) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    // Imperative because beforetoggle fires synchronously before the popover
    // paints; a reactive styleMap update would lag by one microtask.
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
  }

  #selectOption(newValue: VisibilityLevel) {
    this.#dropdownRef.value?.hidePopover();
    if (newValue === this.value) {
      return;
    }
    this.value = newValue;
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  #onEditAccess() {
    this.dispatchEvent(
      new Event("edit-access", { bubbles: true, composed: true })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-visibility-selector": ShareVisibilitySelector;
  }
}
