/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { ModalDismissedEvent } from "../../events/events";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { icons } from "../../styles/icons";
import { behavior } from "../../styles/host/behavior";
import { isCtrlCommand } from "../../utils/is-ctrl-command";

@customElement("bb-modal")
export class VEModal extends LitElement {
  @property()
  accessor icon: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor modalTitle: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor showCloseButton = false;

  @property({ reflect: true, type: Boolean })
  accessor showSaveCancel = false;

  @query("dialog")
  accessor #dialog: HTMLDialogElement | null = null;

  @query("#container")
  accessor #container: HTMLElement | null = null;

  static styles = [
    icons,
    colorsLight,
    type,
    behavior,
    css`
      :host {
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }

      :host([showclosebutton]) dialog #container h1 {
        margin-right: var(--bb-grid-size-8);
      }

      :host([modalTitle]) dialog #container header {
        margin: 0 0 var(--bb-grid-size-4) 0;
      }

      dialog {
        padding: 0;
        margin: 0;
        border: none;
        position: relative;
        background: transparent;
        color: var(--n-0);

        & #container {
          animation: fadeIn 0.3s cubic-bezier(0.5, 0, 0.3, 1) forwards;
          opacity: 0;
          background: var(--n-100);
          padding: var(--bb-grid-size-4) var(--bb-grid-size-6);
          border-radius: var(--bb-grid-size-4);
          position: fixed;
          top: 50%;
          left: 50%;
          translate: -50% -50%;

          & header {
            display: flex;
            align-items: center;

            & h1 {
              margin: 0;
              flex: 1;

              & .g-icon {
                margin-right: var(--bb-grid-size-2);
              }
            }

            & #close {
              padding: 0;
              margin: 0 calc(var(--bb-grid-size) * -1) 0 0;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              border: none;
              background: transparent;
              outline: none;

              &:not([disabled]) {
                cursor: pointer;
              }
            }
          }

          & aside {
            padding: var(--bb-grid-size-6) 0 var(--bb-grid-size-2) 0;
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;

            & #cancel {
              height: 40px;
              border: none;
              background: transparent;

              color: var(--n-0);
              padding: 0 var(--bb-grid-size-4);
              border-radius: var(--bb-grid-size-16);
              margin-right: var(--bb-grid-size-3);
            }

            & #save {
              height: 40px;
              border: none;
              background: var(--n-0);
              border-radius: var(--bb-grid-size-16);

              color: var(--n-100);
              padding: 0 var(--bb-grid-size-4);
            }
          }
        }

        a {
          display: block;
          color: var(--n-80);
          font-weight: 500;
          text-decoration: none;
          text-align: center;
        }

        &::backdrop {
          background: var(--ui-scrim);
        }
      }

      @keyframes fadeIn {
        from {
          transform: scale(0.9, 0.9);
          opacity: 0;
        }

        to {
          transform: none;
          opacity: 1;
        }
      }
    `,
  ];

  #close(withSave = false) {
    if (!this.#dialog) {
      return;
    }

    const dismissalEvent = new ModalDismissedEvent(withSave);
    this.dispatchEvent(dismissalEvent);
    if (dismissalEvent.defaultPrevented) {
      return;
    }

    this.#dialog.close();
  }

  render() {
    return html`<dialog
      @click=${(evt: Event) => {
        const els = evt.composedPath();
        if (els.some((el) => el === this.#container)) {
          return;
        }

        this.#close();
      }}
      @keydown=${(evt: KeyboardEvent) => {
        if (evt.key !== "Escape") {
          return;
        }
        evt.preventDefault();
        this.#close();
      }}
      ${ref((el?: Element) => {
        if (!el) {
          return;
        }

        const dialog = el as HTMLDialogElement;
        requestAnimationFrame(() => {
          dialog.showModal();
        });
      })}
    >
      <section
        id="container"
        class="sans md-body-medium"
        @keydown=${(evt: KeyboardEvent) => {
          if (evt.key !== "Enter" || !isCtrlCommand(evt)) {
            return;
          }

          this.#close(true);
        }}
      >
        <header>
          ${this.modalTitle
            ? html`
                <h1 class="sans-flex w-500 round md-title-medium">
                  ${this.icon
                    ? html`<span class="g-icon">${this.icon}</span>`
                    : nothing}
                  ${this.modalTitle}
                </h1>
                ${this.showCloseButton
                  ? html`<button
                      id="close"
                      @click=${() => {
                        this.#close();
                      }}
                    >
                      <span class="g-icon">close</span>
                    </button>`
                  : nothing}
              `
            : nothing}
        </header>
        <slot></slot>

        ${this.showSaveCancel
          ? html`<aside>
              <button
                id="cancel"
                class="cursor md-label-large sans-flex"
                @click=${() => {
                  this.#close();
                }}
              >
                Cancel
              </button>
              <button
                id="save"
                class="cursor"
                @click=${() => {
                  this.#close(true);
                }}
              >
                Save
              </button>
            </aside>`
          : nothing}
      </section>
    </dialog>`;
  }
}
