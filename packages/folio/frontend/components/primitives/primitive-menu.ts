/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { icons } from "../../ui/icons.js";
import { MenuItem } from "../../sca/types.js";

@customElement("o-primitive-menu")
export class PrimitiveMenu extends SignalWatcher(LitElement) {
  @property({ type: Array })
  accessor items: MenuItem[] = [];

  @state()
  private accessor _highlighted = 0;

  private _toggleRef: Ref<HTMLButtonElement> = createRef();
  private _dialogRef: Ref<HTMLDialogElement> = createRef();

  static styles = [
    icons,
    css`
      :host {
        display: inline-block;
        position: relative;
      }

      button.trigger {
        background: none;
        border: none;
        cursor: pointer;
        width: 40px;
        height: 40px;
        padding: 0;
        border-radius: var(--opal-radius-circle, 50%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--opal-color-on-surface-variant);

        &:hover {
          background-color: var(--opal-color-surface-container-highest);
        }

        & .g-icon {
          --g-icon-font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      dialog {
        position: fixed;
        left: var(--left);
        top: var(--top);
        background: var(--opal-color-surface);
        margin: 0;
        padding: 0;
        border: 1px solid var(--opal-color-border-subtle);
        border-radius: var(--opal-radius-16);
        box-shadow: var(--opal-shadow-elevated);
        color: var(--opal-color-on-surface);

        opacity: var(--opacity, 0);
        transition: opacity 0.2s ease;

        &::backdrop {
          opacity: 0;
        }

        & menu {
          padding: 0;
          margin: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
        }

        & li button {
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          padding: var(--opal-grid-3) var(--opal-grid-4) var(--opal-grid-3)
            var(--opal-grid-3);
          cursor: pointer;
          border-radius: var(--opal-radius-small);
          color: var(--opal-color-on-surface);
          font-family: var(--opal-font-display);
          font-size: var(--opal-body-medium-size);
          white-space: nowrap;

          display: flex;
          align-items: center;
          gap: var(--opal-grid-3);

          &:hover,
          &.active {
            background-color: var(--opal-color-interactive-surface);
          }

          & .g-icon {
            --g-icon-font-size: 20px;
            width: 20px;
            height: 20px;
            color: var(--opal-color-on-surface-variant);
          }
        }
      }
    `,
  ];

  private _openMenu() {
    const dialog = this._dialogRef.value;
    const trigger = this._toggleRef.value;
    if (!dialog || !trigger) return;

    this.style.setProperty("--opacity", "0");
    dialog.showModal();

    requestAnimationFrame(() => {
      const bounds = trigger.getBoundingClientRect();
      const dialogBounds = dialog.getBoundingClientRect();

      let { left, top } = bounds;
      const { height } = bounds;
      const dialogHeight = dialogBounds.height;
      const dialogWidth = dialogBounds.width;

      top += height + 8;

      if (top + dialogHeight > window.innerHeight) {
        top = bounds.top - dialogHeight - 8;
      }

      if (left + dialogWidth > window.innerWidth) {
        left = window.innerWidth - dialogWidth;
      }

      this.style.setProperty("--top", `${top}px`);
      this.style.setProperty("--left", `${left}px`);
      this.style.setProperty("--opacity", "1");
    });
  }

  private _onItemClick(item: string) {
    this._dialogRef.value?.close();
    this.dispatchEvent(
      new CustomEvent("action-select", {
        detail: { item },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (this.items.length === 0) return nothing;

    return html`
      <button
        class="trigger"
        ${ref(this._toggleRef)}
        @click=${() => this._openMenu()}
      >
        <span class="g-icon filled heavy round">more_vert</span>
      </button>

      <dialog
        ${ref(this._dialogRef)}
        @click=${(evt: PointerEvent) => {
          const [top] = evt.composedPath();
          if (top === this._dialogRef.value) {
            this._dialogRef.value.close();
          }
        }}
        @close=${() => {
          this.style.setProperty("--opacity", "0");
        }}
      >
        <menu>
          ${repeat(
            this.items,
            (item) => item.name,
            (item, idx) => html`
              <li>
                <button
                  class=${this._highlighted === idx ? "active" : ""}
                  @pointerover=${() => (this._highlighted = idx)}
                  @click=${() => this._onItemClick(item.name)}
                >
                  ${item.icon
                    ? html`<span class="g-icon filled">${item.icon}</span>`
                    : nothing}
                  <span>${item.title}</span>
                </button>
              </li>
            `
          )}
        </menu>
      </dialog>
    `;
  }
}
