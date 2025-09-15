/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { StateEvent } from "../events/events";
import { Action } from "../types/types";

@customElement("gulf-button")
export class Button extends Root {
  @property()
  accessor label: string | null = null;

  @property()
  accessor action: Action | null = null;

  static styles = css`
    :host {
      display: block;
    }

    button {
      border-radius: 32px;
      background: #333;
      color: #fff;
      border: none;
      padding: 8px 16px;
    }
  `;

  render() {
    return html`<button
      @click=${() => {
        if (!this.action) {
          return;
        }

        const evt = new StateEvent<"gulf.action">({
          eventType: "gulf.action",
          action: this.action,
        });

        this.dispatchEvent(evt);
      }}
    >
      ${this.label}
    </button>`;
  }
}
