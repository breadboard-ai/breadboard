/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bbrt-activate-modal")
export class BBRTActivateModal extends LitElement {
  @property()
  accessor name: string | undefined = undefined;

  @property({ reflect: true })
  accessor state: "pending" | "allowed" | "denied" = "pending";

  static override styles = css`
    :host {
      display: inline-block;
    }
    #buttons {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
    button {
      background: #ffffff;
      border: none;
      border-radius: 50px;
      padding: 5px 20px;
      margin: 12px 0 0 12px;
      cursor: pointer;
      font-size: 14px;
      color: #fff;
      background: #3399ff;
    }
    button:hover {
      opacity: 80%;
    }
    #deny {
      background: #868686;
    }
    [disabled] {
      opacity: 50%;
      cursor: none;
    }
    pre {
      overflow-wrap: anywhere;
      white-space: normal;
    }
  `;

  override render() {
    return html`
      <span>Activate board?</span>
      <pre>${this.name ?? "Unknown board"}</pre>
      <div id="buttons">
        <button
          id="allow"
          @click=${this.#clickAllow}
          ?disabled=${this.state !== "pending"}
        >
          Allow
        </button>
        <button
          id="deny"
          @click=${this.#clickDeny}
          ?disabled=${this.state !== "pending"}
        >
          Deny
        </button>
      </div>
    `;
  }

  #clickAllow() {
    this.state = "allowed";
    this.dispatchEvent(new Event("allow"));
  }

  #clickDeny() {
    this.state = "denied";
    this.dispatchEvent(new Event("deny"));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-activate-modal": BBRTActivateModal;
  }
}
