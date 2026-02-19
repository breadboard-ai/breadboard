/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as A2UI from "../../../../a2ui/index.js";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("a2ui-custom-pdf-viewer")
export class A2UICustomPDFViewer extends A2UI.v0_8.UI.Root {
  @property()
  accessor fileUri: A2UI.v0_8.Primitives.StringValue | null = null;

  @property()
  accessor url: A2UI.v0_8.Primitives.StringValue | null = null;

  static styles = [
    css`
      :host {
        display: block;
        aspect-ratio: 3/4;
        overflow: auto;
        min-height: 1;
        flex: 1;
      }

      section {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
      }

      bb-pdf-viewer {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  render() {
    const fileUri = A2UI.v0_8.UI.Utils.extractStringValue(
      this.fileUri,
      this.component,
      this.processor,
      this.surfaceId
    );
    const url = A2UI.v0_8.UI.Utils.extractStringValue(
      this.url,
      this.component,
      this.processor,
      this.surfaceId
    );

    const pdfUrl = fileUri || url;
    if (!pdfUrl) return html`Unable to render PDF`;

    return html`<section>
      <bb-pdf-viewer .url=${pdfUrl} .showControls=${true}></bb-pdf-viewer>
    </section>`;
  }
}
