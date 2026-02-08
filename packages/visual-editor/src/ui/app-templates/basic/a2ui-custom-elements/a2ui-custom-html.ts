/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as A2UI from "../../../../a2ui/index.js";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeCSS } from "lit";
import { until } from "lit/directives/until.js";
import { nothing } from "lit";

import "../../../../app-sandbox/app-sandbox-element.js";

@customElement("a2ui-custom-html")
export class A2UICustomHTML extends A2UI.v0_8.UI.Root {
  @property()
  accessor srcdoc: A2UI.v0_8.Primitives.StringValue | null = null;

  @property()
  accessor url: A2UI.v0_8.Primitives.StringValue | null = null;

  static styles = [
    unsafeCSS(A2UI.v0_8.Styles.structuralStyles),
    css`
      :host {
        display: block;
      }

      bb-app-sandbox::part(iframe) {
        height: 700px;
      }
    `,
  ];

  render() {
    const srcdoc = A2UI.v0_8.UI.Utils.extractStringValue(
      this.srcdoc,
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

    let htmlContent: unknown = nothing;
    if (srcdoc) {
      htmlContent = srcdoc;
    } else if (url) {
      htmlContent = until(
        fetch(url)
          .then((res) => res.text())
          .catch(() => "Unable to load HTML content")
      );
    }

    if (htmlContent === nothing) {
      return html`<p>No HTML content provided.</p>`;
    }

    return html`<section>
      <bb-app-sandbox .srcdoc=${htmlContent}></bb-app-sandbox>
    </section>`;
  }
}
