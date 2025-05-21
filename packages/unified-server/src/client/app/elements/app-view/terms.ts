/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

const TOS_KEY = "tos-status";
enum TosStatus {
  ACCEPTED = "accepted",
}

@customElement("terms-of-service")
export class TermsOfService extends LitElement {
  @property()
  accessor tosHtml: string = "";

  static styles = css`
    :host {
      display: block;
    }

    dialog {
      max-width: 800px;
      max-height: 920px;

      border-radius: var(--bb-grid-size-4);
      border: none;
      padding: 0;

      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      width: 90%;
    }

    form {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
      margin: auto;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    h1 {
      display: flex;
      align-items: center;
      margin: 0;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      height: var(--bb-grid-size-14);
      border-bottom: 1px solid var(--bb-neutral-100);
      padding: 0 var(--bb-grid-size-6);
    }

    .tos-content {
      flex-grow: 1;
      overflow-y: auto;
      max-height: 320px;
      padding: var(--bb-grid-size-4) var(--bb-grid-size-6);
      font: 400 var(--bb-body-large) / var(--bb-body-line-height-large)
        var(--bb-font-family);
      outline: none;
    }

    .controls {
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid var(--bb-neutral-100);
      padding: var(--bb-grid-size-6);
    }

    button {
      padding: var(--bb-grid-size-2);
      cursor: pointer;
      border: none;
      border-radius: 4px;
      background-color: var(--bb-ui-600);
      color: white;
    }
  `;

  #dialogRef: Ref<HTMLDialogElement> = createRef();

  protected firstUpdated(): void {
    if (!this.#dialogRef.value) {
      return;
    }

    this.#dialogRef.value.showModal();
  }

  render() {
    return html`<dialog ${ref(this.#dialogRef)}>
      <form method="dialog">
        <h1>Terms of Service</h1>
        <div class="tos-content">${unsafeHTML(this.tosHtml)}</div>
        <div class="controls">
          <button
            @click=${() => {
              localStorage.setItem(TOS_KEY, TosStatus.ACCEPTED);
              this.remove();
            }}
          >
            Continue
          </button>
        </div>
      </form>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "terms-of-service": TermsOfService;
  }
}
