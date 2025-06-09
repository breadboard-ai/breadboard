/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { OverlayDismissedEvent } from "../../events/events";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { icons } from "../../styles/icons";

@customElement("bb-modal")
export class Modal extends LitElement {
  @property()
  accessor icon: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor modalTitle: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor showCloseButton = false;

  @query("dialog")
  accessor #dialog: HTMLDialogElement | null = null;

  @query("#container")
  accessor #container: HTMLElement | null = null;

  static styles = [
    icons,
    colorsLight,
    type,
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

  #close() {
    if (!this.#dialog) {
      return;
    }

    this.#dialog.close();
    this.dispatchEvent(new OverlayDismissedEvent());
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
      <section id="container" class="sans md-body-medium">
          <header>${
            this.modalTitle
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
              : nothing
          }
          </header>
          <slot>
      </section>
    </dialog>`;
  }
}
