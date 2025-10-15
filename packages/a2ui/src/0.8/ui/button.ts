/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { StateEvent } from "../events/events";
import { StringValue } from "../types/primitives";
import * as Styles from "./styles";
import { classMap } from "lit/directives/class-map.js";
import { Action } from "../types/components";
import { A2UIModelProcessor } from "../data/model-processor";

@customElement("a2ui-button")
export class Button extends Root {
  @property()
  accessor label: StringValue | null = null;

  @property()
  accessor action: Action | null = null;

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
          if (!this.action) {
            return;
          }
          const evt = new StateEvent<"a2ui.action">({
            eventType: "a2ui.action",
            action: this.action,
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
      } else if ("literal" in this.label && this.label.literal !== undefined) {
        return innerRender(this.label.literal);
      } else if (this.label && "path" in this.label && this.label.path) {
        if (!this.processor || !this.component) {
          return html`(no model)`;
        }

        const labelValue = this.processor.getData(
          this.component,
          this.label.path,
          this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
        );

        if (labelValue === null) {
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
