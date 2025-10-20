/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { markdown } from "./directives/directives";
import { Root } from "./root";
import { StringValue } from "../types/primitives";
import * as Styles from "./styles";
import { appendToAll } from "./utils/utils";
import { classMap } from "lit/directives/class-map.js";
import { A2UIModelProcessor } from "../data/model-processor";

@customElement("a2ui-text")
export class Text extends Root {
  @property()
  accessor text: StringValue | null = null;

  static styles = [
    Styles.all,
    css`
      :host {
        display: block;
        flex: var(--weight);
      }
    `,
  ];

  #renderText() {
    if (this.text && typeof this.text === "object") {
      if ("literalString" in this.text && this.text.literalString) {
        return html`${markdown(
          this.text.literalString,
          appendToAll(this.theme.markdown, ["ol", "ul", "li"], {})
        )}`;
      } else if ("literal" in this.text && this.text.literal !== undefined) {
        return html`${markdown(
          this.text.literal,
          appendToAll(this.theme.markdown, ["ol", "ul", "li"], {})
        )}`;
      } else if (this.text && "path" in this.text && this.text.path) {
        if (!this.processor || !this.component) {
          return html`(no model)`;
        }

        const textValue = this.processor.getData(
          this.component,
          this.text.path,
          this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
        );

        if (textValue === null) {
          return html`(empty)`;
        }

        return html`${markdown(
          textValue.toString(),
          appendToAll(this.theme.markdown, ["ol", "ul", "li"], {})
        )}`;
      }
    }

    return html`(empty)`;
  }

  render() {
    return html`<section class=${classMap(this.theme.components.Text)}>
      ${this.#renderText()}
    </section>`;
  }
}
