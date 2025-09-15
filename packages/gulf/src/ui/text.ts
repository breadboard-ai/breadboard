/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { markdown } from "../directives/directives";
import { Root } from "./root";
import { getData } from "../utils/utils";

@customElement("gulf-text")
export class Text extends Root {
  @property()
  accessor text: string | { dataBinding: string } | null = null;

  static styles = css`
    :host {
      display: block;
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
    if (typeof this.text === "string") {
      return html`${markdown(this.text)}`;
    } else if (this.text && typeof this.text === "object") {
      if (
        this.data &&
        typeof this.data === "object" &&
        !Array.isArray(this.data)
      ) {
        const value = getData(this.data, this.text.dataBinding);
        if (!value) {
          return html`(empty)`;
        }

        return html`${markdown(value.toString())}`;
      }
    }

    return html`(empty)`;
  }
}
