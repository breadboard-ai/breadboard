/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { ModalDismissedEvent } from "../../events/events.js";
import { baseColors } from "../../styles/host/base-colors.js";
import { type } from "../../styles/host/type.js";
import { icons } from "../../styles/icons.js";
import { behavior } from "../../styles/host/behavior.js";
import { isCtrlCommand } from "../../input/is-ctrl-command.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-modal")
export class VEModal extends LitElement {
  @property()
  accessor icon: string | null = null;

  @property({ reflect: true, type: String })
  accessor modalTitle: string | null = null;

  /**
   * "basic" has a larger & centered title, more padding, and rounder corners.
   */
  @property({ reflect: true, type: String })
  accessor appearance: "basic" | "complex" = "complex";

  @property({ reflect: true, type: Boolean })
  accessor showCloseButton = false;

  @property({ reflect: true, type: Boolean })
  accessor showSaveCancel = false;

  @property({ reflect: true, type: Boolean })
  accessor saveButtonDisabled = false;

  @property()
  accessor saveButtonLabel = "Save";

  @property({ reflect: true, type: Boolean })
  accessor blurBackground = false;

  @query("dialog")
  accessor #dialog: HTMLDialogElement | null = null;

  @query("#container")
  accessor #container: HTMLElement | null = null;

  static styles = [
    icons,
    baseColors,
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

      :host([appearance="basic"]) {
        #container {
          padding: var(--bb-grid-size-9) !important;
          border-radius: var(--bb-grid-size-5) !important;
        }
        header {
          margin-bottom: 0 !important;
        }
        ::slotted(*) {
          margin-top: var(--bb-grid-size-6) !important;
        }
        #title {
          justify-content: center;
          text-align: center;
        }
      }

      :host([appearance="basic"][showCloseButton]) {
        #title {
          /* Fix centering */
          margin-right: calc(-1 * var(--bb-grid-size-4));
        }
      }

      dialog {
        padding: 0;
        margin: 0;
        border: none;
        position: relative;
        background: transparent;
        color: var(--color, var(--light-dark-n-0));

        & #container {
          animation: fadeAndScaleIn 0.3s cubic-bezier(0.5, 0, 0.3, 1) 0.15s
            backwards;
          background: light-dark(var(--n-100), var(--n-15));
          padding: var(--bb-grid-size-4) var(--bb-grid-size-6);
          border-radius: var(--bb-grid-size-4);
          position: fixed;
          top: 50%;
          left: 50%;
          translate: -50% -50%;
          box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.1);
          min-width: 300px;
          box-sizing: border-box;

          & header {
            display: flex;
            align-items: center;

            & h1 {
              margin: 0;
              flex: 1;
              display: flex;
              align-items: center;

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

              color: var(--light-dark-n-0);
              padding: 0 var(--bb-grid-size-4);
              border-radius: var(--bb-grid-size-16);
              margin-right: var(--bb-grid-size-3);
            }

            & #save {
              height: 40px;
              border: none;
              background: var(--light-dark-n-0);
              border-radius: var(--bb-grid-size-16);

              color: var(--light-dark-n-100);
              padding: 0 var(--bb-grid-size-4);

              &[disabled] {
                opacity: 0.4;
                cursor: default;
              }
            }
          }
        }

        a {
          display: block;
          color: var(--light-dark-n-80);
          font-weight: 500;
          text-decoration: none;
          text-align: center;
        }

        &::backdrop {
          animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
          background: var(--ui-scrim);
        }
      }

      :host([blurbackground]) dialog::backdrop {
        backdrop-filter: blur(16px);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }

      @keyframes fadeAndScaleIn {
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
        part="container"
        class="sans md-body-medium"
        @keydown=${(evt: KeyboardEvent) => {
          if (evt.key !== "Enter" || !isCtrlCommand(evt)) {
            return;
          }

          this.#close(true);
        }}
      >
        <header part="header">
          ${this.modalTitle
            ? html`
                <h1
                  id="title"
                  class=${classMap({
                    "sans-flex": true,
                    "w-500": true,
                    round: true,
                    "md-title-medium": this.appearance === "complex",
                    "md-headline-small": this.appearance === "basic",
                  })}
                >
                  ${this.icon
                    ? html`<span class="g-icon round filled"
                        >${this.icon}</span
                      >`
                    : nothing}
                  ${this.modalTitle}
                </h1>
                <slot name="header-actions"></slot>
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
                ?disabled=${this.saveButtonDisabled}
                @click=${() => {
                  this.#close(true);
                }}
              >
                ${this.saveButtonLabel}
              </button>
            </aside>`
          : nothing}
      </section>
    </dialog>`;
  }
}
