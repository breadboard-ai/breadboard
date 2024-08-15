/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import {
  BoardServerAPIKeyEnterEvent,
  OverlayDismissEvent,
} from "../../events/events.js";

@customElement("bb-board-server-key")
export class BoardServerKey extends LitElement {
  @property()
  key: string | null = null;

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
      z-index: 1000;
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

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key !== "Escape") {
      return;
    }

    this.dispatchEvent(new OverlayDismissEvent());
  }

  render() {
    return html`<dialog open>
      <h1>Please enter your Board Server API key</h1>
      <form
        ${ref(this.#formRef)}
        method="dialog"
        @submit=${(evt: Event) => {
          if (!(evt.target instanceof HTMLFormElement)) {
            return;
          }

          if (!this.#formRef.value) {
            return;
          }

          const el =
            this.#formRef.value.querySelector<HTMLInputElement>(`#server-key`);

          if (!el) {
            return;
          }

          const key = el.value;
          if (!key) {
            return;
          }

          this.dispatchEvent(new BoardServerAPIKeyEnterEvent(key));
        }}
      >
        <div class="secret">
          <label for="server-key">Board Server API Key</label>
          <input
            .name=${"server-key"}
            .placeholder=${"Your Board Server API Key"}
            .id=${"server-key"}
            .value=${this.key}
            required
            type="password"
          />
        </div>

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
