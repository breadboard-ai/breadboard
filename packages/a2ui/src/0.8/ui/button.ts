/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { StateEvent } from "../events/events";
import { UserAction } from "../types/types";
import { StringValue } from "../types/primitives";
import * as Styles from "./styles";
import { classMap } from "lit/directives/class-map.js";

@customElement("a2ui-button")
export class Button extends Root {
  @property()
  accessor label: StringValue | null = null;

  @property()
  accessor userAction: UserAction | null = null;

  static styles = [
    Styles.all,
    css`
      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
      }
    `,
  ];

  #renderButton() {
    const innerRender = (label: string) => {
      return html`<button
        class=${classMap(this.theme.components.Button)}
        @click=${() => {
          if (!this.userAction) {
            return;
          }
          const evt = new StateEvent<"a2ui.action">({
            eventType: "a2ui.action",
            userAction: this.userAction,
            dataContextPath: this.dataContextPath,
            sourceComponentId: this.id,
          });
          this.dispatchEvent(evt);
        }}
      >
        ${label}
      </button>`;
    };

    if (this.label && typeof this.label === "object") {
      if ("literalString" in this.label && this.label.literalString) {
        return innerRender(this.label.literalString);
      } else if (this.label && "path" in this.label && this.label.path) {
        if (!this.processor) {
          return html`(no model)`;
        }

        const labelValue = this.processor.getDataByPath(
          `${this.dataContextPath}${this.label.path}`,
          this.surfaceId
        );

        if (!labelValue) {
          return html`Invalid label`;
        }

        if (typeof labelValue !== "string") {
          return html`Invalid label`;
        }

        return innerRender(labelValue);
      }
    }

    return nothing;
  }

  render() {
    return this.#renderButton();
  }
}
