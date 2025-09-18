/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { markdown } from "../directives/directives";
import { Root } from "./root";
// import { getData } from "../data/builder";
import { until } from "lit/directives/until.js";
import { StringValue } from "../types/component-update";

@customElement("gulf-text")
export class Text extends Root {
  @property()
  accessor text: StringValue | null = null;

  static styles = css`
    :host {
      display: block;
      flex: var(--weight);
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
      padding: 0;
    }
  `;

  render() {
    if (this.text && typeof this.text === "object") {
      if ("literalString" in this.text && this.text.literalString) {
        return html`${markdown(this.text.literalString)}`;
      } else if (this.text && "path" in this.text && this.text.path) {
        if (!this.model) {
          return html`(no model)`;
        }

        const textValue = this.model
          ?.getDataProperty(this.text.path, this.dataPrefix)
          .then((data) => {
            if (typeof data !== "string") {
              return html`(invalid)`;
            }
            return html`${markdown(data)}`;
          });
        return html`${until(textValue)}`;
      }
    }

    return html`(empty)`;
  }
}
