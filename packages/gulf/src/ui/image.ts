/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { getData } from "../utils/utils";

@customElement("gulf-image")
export class Image extends Root {
  @property()
  accessor url: string | { dataBinding: string } | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    img {
      display: block;
      width: 100%;
      border-radius: 4px;
    }
  `;

  render() {
    if (!this.url) {
      return nothing;
    }

    if (this.url && typeof this.url === "string") {
      return html`<img src=${this.url} />`;
    } else if (this.url && typeof this.url === "object") {
      if (
        this.data &&
        typeof this.data === "object" &&
        !Array.isArray(this.data)
      ) {
        const value = getData(this.data, this.url.dataBinding);
        if (!value) {
          return html`(empty)`;
        }

        return html`<img src=${value} />`;
      }
    }

    return html`(empty)`;
  }
}
