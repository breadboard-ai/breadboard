/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { StateEvent } from "../events/events";
import { Action, StringValue } from "../types/component-update";
import { until } from "lit/directives/until.js";

@customElement("gulf-button")
export class Button extends Root {
  @property()
  accessor label: StringValue | null = null;

  @property()
  accessor action: Action | null = null;

  static styles = css`
    :host {
      display: block;
      flex: var(--weight);
    }

    button {
      border-radius: 32px;
      background: #333;
      color: #fff;
      border: none;
      padding: 8px 16px;
      cursor: pointer;
    }
  `;

  #renderButton(label: string) {
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
      ${label}
    </button>`;
  }

  render() {
    if (this.label && typeof this.label === "object") {
      if ("literalString" in this.label && this.label.literalString) {
        return this.#renderButton(this.label.literalString);
      } else if (this.label && "path" in this.label && this.label.path) {
        if (!this.model) {
          return html`(no model)`;
        }

        const labelValue = this.model
          ?.getDataProperty(this.label.path, this.dataPrefix)
          .then((data) => {
            if (typeof data !== "string") {
              return html`(invalid)`;
            }
            return this.#renderButton(data);
          });
        return html`${until(labelValue)}`;
      }
    }

    return nothing;
  }
}
