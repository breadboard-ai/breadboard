/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root";
import { StringValue } from "../types/primitives";
import * as Styles from "./styles";
import { classMap } from "lit/directives/class-map.js";
import { A2UIModelProcessor } from "../data/model-processor";

@customElement("a2ui-audioplayer")
export class Audio extends Root {
  @property()
  accessor url: StringValue | null = null;

  static styles = [
    Styles.all,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        flex: var(--weight);
        min-height: 0;
        overflow: auto;
      }

      audio {
        display: block;
        width: 100%;
      }
    `,
  ];

  #renderAudio() {
    if (!this.url) {
      return nothing;
    }

    if (this.url && typeof this.url === "object") {
      if ("literalString" in this.url) {
        return html`<audio controls src=${this.url.literalString} />`;
      } else if ("literal" in this.url) {
        return html`<audio controls src=${this.url.literal} />`;
      } else if (this.url && "path" in this.url && this.url.path) {
        if (!this.processor || !this.component) {
          return html`(no processor)`;
        }

        const audioUrl = this.processor.getData(
          this.component,
          this.url.path,
          this.surfaceId ?? A2UIModelProcessor.DEFAULT_SURFACE_ID
        );
        if (!audioUrl) {
          return html`Invalid audio URL`;
        }

        if (typeof audioUrl !== "string") {
          return html`Invalid audio URL`;
        }
        return html`<audio controls src=${audioUrl} />`;
      }
    }

    return html`(empty)`;
  }

  render() {
    return html`<section class=${classMap(this.theme.components.AudioPlayer)}>
      ${this.#renderAudio()}
    </section>`;
  }
}
