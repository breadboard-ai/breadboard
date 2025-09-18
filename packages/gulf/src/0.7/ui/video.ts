/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { until } from "lit/directives/until.js";
import { StringValue } from "../types/component-update";

@customElement("gulf-video")
export class Video extends Root {
  @property()
  accessor url: StringValue | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      flex: var(--weight);
    }

    video {
      display: block;
      width: 100%;
      border-radius: 8px;
    }
  `;

  render() {
    if (!this.url) {
      return nothing;
    }

    if (this.url && typeof this.url === "object") {
      if ("literalString" in this.url) {
        return html`<video src=${this.url.literalString} />`;
      } else if (this.url && "path" in this.url && this.url.path) {
        if (!this.model) {
          return html`(no model)`;
        }

        const imageUrl = this.model
          ?.getDataProperty(this.url.path, this.dataPrefix)
          .then((data) => {
            if (typeof data !== "string") {
              return html`(invalid)`;
            }
            return html`<video controls src=${data} />`;
          });
        return html`${until(imageUrl)}`;
      }
    }

    return html`(empty)`;
  }
}
