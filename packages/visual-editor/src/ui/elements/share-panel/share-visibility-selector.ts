/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { scaContext } from "../../../sca/context/context.js";
import type { VisibilityLevel } from "../../../sca/controller/subcontrollers/editor/share-controller.js";
import { SCA } from "../../../sca/sca.js";
import { icons } from "../../styles/icons.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { match } from "../../styles/host/match.js";

interface Option {
  level: VisibilityLevel;
  label: string;
  icon: string;
  subtitle: string;
  disabled?: boolean;
}

@customElement("bb-share-visibility-selector")
export class ShareVisibilitySelector extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    baseColors,
    match,
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
        background: var(--light-dark-n-90);
        color: var(--sys-color--on-surface);

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
          background: var(--light-dark-n-95);
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
        color: var(--light-dark-n-35);
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
        color-scheme: var(--color-scheme, inherit);

        z-index: 1000;
        min-width: 220px;
        background: light-dark(#fff, #2d2d2d);
        border: 1px solid light-dark(#e0e0e0, #555);
        border-radius: 12px;
        box-shadow:
          0 2px 6px rgba(0, 0, 0, 0.15),
          0 8px 24px rgba(0, 0, 0, 0.25);
        padding: var(--bb-grid-size-2) 0;
        color: light-dark(#1b1b1b, #e0e0e0);
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
        color: var(--sys-color--on-surface);
        border: none;
        background: none;
        width: 100%;
        text-align: left;

        &:hover:not(:disabled) {
          background: light-dark(#f0f0f0, #3a3a3a);
        }

        &:disabled {
          opacity: 0.5;
          cursor: default;
        }
      }

      .option-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .option-disabled-reason {
        font-size: 12px;
        font-weight: 300;
        line-height: 16px;
        color: var(--light-dark-n-35);
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
        color: var(--sys-color--primary);
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
        background: var(--light-dark-n-0);
        color: var(--light-dark-n-100);
        font-family: var(--bb-font-family-flex);
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        letter-spacing: 0;
        border: none;
        cursor: pointer;
        white-space: nowrap;

        &:hover {
          background: var(--light-dark-n-25);
        }
      }

      #subtitle {
        color: var(--light-dark-n-35);
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

  @consume({ context: scaContext })
  @property({ attribute: false })
  accessor sca!: SCA;

  readonly #triggerRef = createRef<HTMLButtonElement>();
  readonly #dropdownRef = createRef<HTMLDivElement>();

  get #share() {
    return this.sca.controller.editor.share;
  }

  get #loading() {
    return this.#share.status === "changing-visibility";
  }

  get #broadPermissionIsAnyone(): boolean {
    return this.sca.env.googleDrive.broadPermissions.some(
      (p) => p.type === "anyone"
    );
  }

  get #options(): Option[] {
    const { broadPermissionsAllowed } = this.#share;
    return [
      {
        level: "only-you",
        label: "Only you",
        icon: "lock",
        subtitle: "Only you can open this link",
      },
      this.#broadPermissionIsAnyone
        ? {
            level: "broad",
            label: "Anyone with the link",
            icon: "public",
            subtitle: broadPermissionsAllowed
              ? "Anyone on the internet with the link can view"
              : `Disabled for ${this.#share.userDomain} users`,
            disabled: !broadPermissionsAllowed,
          }
        : {
            level: "broad",
            label: "Your organization",
            icon: "domain",
            subtitle: broadPermissionsAllowed
              ? "Anyone in your organization with the link can view"
              : `Disabled for ${this.#share.userDomain} users`,
            disabled: !broadPermissionsAllowed,
          },
      {
        level: "custom",
        label: "Custom",
        icon: "tune",
        subtitle: "Choose specific people or groups who can open the link",
      },
    ];
  }

  render() {
    const opt = this.#options.find((o) => o.level === this.#share.visibility)!;

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
            ?disabled=${this.#loading}
          >
            <span id="label">${opt.label}</span>
            <span class="g-icon">arrow_drop_down</span>
          </button>
          <span id="subtitle">${opt.subtitle}</span>
        </div>
        ${this.#loading
          ? html`<span class="g-icon spinner">progress_activity</span>`
          : this.#share.visibility === "custom"
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
              class="dropdown-option ${opt.disabled ? "disabled" : ""}"
              ?disabled=${opt.disabled}
              @click=${() => this.#selectOption(opt.level)}
            >
              <span class="check-icon">
                ${opt.level === this.#share.visibility
                  ? html`<span class="g-icon">check</span>`
                  : nothing}
              </span>
              <span class="option-content">
                <span class="option-label">${opt.label}</span>
                ${opt.disabled
                  ? html`<span class="option-disabled-reason"
                      >${opt.subtitle}</span
                    >`
                  : nothing}
              </span>
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
    if (newValue === this.#share.visibility) {
      return;
    }
    this.sca.actions.share.changeVisibility(newValue);
  }

  #onEditAccess() {
    this.sca.actions.share.viewSharePermissions();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-share-visibility-selector": ShareVisibilitySelector;
  }
}
