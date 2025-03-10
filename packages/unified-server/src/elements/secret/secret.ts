/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { OverlayDismissEvent, SecretsEnterEvent } from "../../events/events.js";

@customElement("bb-secret-requester")
export class SecretRequester extends LitElement {
  @property()
  secrets: string[] = [];

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.05);
      position: fixed;
      top: 0;
      z-index: 100;
      align-items: center;
      animation: fadeIn 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    dialog {
      background: var(--bb-neutral-0);
      width: 80vw;
      max-width: 300px;
      border: none;
      border-radius: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-3);
    }

    dialog h1 {
      font: var(--bb-font-title-small);
      margin: 0 0 var(--bb-grid-size-2) 0;
      padding-left: var(--bb-grid-size-6);
      background: transparent var(--bb-icon-password) 0 center / 20px 20px
        no-repeat;
    }

    .secret {
      display: flex;
      flex-direction: column;
      margin-bottom: var(--bb-grid-size-2);
    }

    .secret label {
      display: block;
      font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    .secret input {
      display: block;
      width: 100%;
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0);
      padding: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);

      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
    }

    #continue {
      background: var(--bb-ui-100) var(--bb-icon-resume-blue) 8px 4px / 16px
        16px no-repeat;
      color: var(--bb-ui-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    #cancel {
      background: var(--bb-neutral-100);
      color: var(--bb-neutral-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) var(--bb-grid-size);
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  #formRef: Ref<HTMLFormElement> = createRef();

  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onClickBound = this.#onClick.bind(this);

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.#onKeyDownBound);
    window.addEventListener("click", this.#onClickBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.#onKeyDownBound);
    window.removeEventListener("click", this.#onClickBound);
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key === "Escape") {
      this.dispatchEvent(new OverlayDismissEvent());
      return;
    }

    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

    if (evt.key === "Enter" && isCtrlCommand && this.#formRef.value) {
      this.#formRef.value.dispatchEvent(new SubmitEvent("submit"));
    }
  }

  #onClick() {
    this.dispatchEvent(new OverlayDismissEvent());
  }

  protected firstUpdated(): void {
    if (!this.#formRef.value) {
      return;
    }

    const input = this.#formRef.value.querySelector<HTMLInputElement>("input");
    if (!input) {
      return;
    }

    input.select();
  }

  render() {
    return html`<dialog
      open
      @click=${(evt: Event) => {
        evt.stopImmediatePropagation();
      }}
    >
      <h1>Please enter the following secrets</h1>
      <form
        ${ref(this.#formRef)}
        method="dialog"
        @submit=${() => {
          if (!this.#formRef.value) {
            return;
          }

          if (!this.#formRef.value.checkValidity()) {
            this.#formRef.value.reportValidity();
            return;
          }

          const values: [string, string][] = this.secrets.map((secret) => {
            if (!this.#formRef.value) {
              return [secret, ""];
            }

            const el = this.#formRef.value.querySelector<HTMLInputElement>(
              `#${secret}`
            );
            if (!el) {
              return [secret, ""];
            }

            return [secret, el.value];
          });

          this.dispatchEvent(new SecretsEnterEvent(Object.fromEntries(values)));
        }}
      >
        ${this.secrets.map((secret) => {
          if (secret.startsWith("connection:")) {
            return html`<bb-connection-input
              id=${secret}
              .connectionId=${secret.slice("connection:".length)}
            ></bb-connection-input>`;
          }
          return html`<div class="secret">
            <label for=${secret}>${secret}</label>
            <input
              .name=${secret}
              .placeholder=${secret}
              .id=${secret}
              autofocus
              required
              type="password"
            />
          </div>`;
        })}

        <button id="continue">Continue</button>
        <button
          @click=${() => {
            this.dispatchEvent(new OverlayDismissEvent());
          }}
          id="cancel"
        >
          Cancel
        </button>
      </form>
    </dialog>`;
  }
}
