/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema7 } from "json-schema";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bbrt-content")
export class BBRTContent extends LitElement {
  @property({ type: Object })
  accessor schema: JSONSchema7 | undefined = undefined;

  @property({ type: Object })
  accessor data: unknown | undefined = undefined;

  static override styles = css`
    :host {
      display: block;
    }
  `;

  override render() {
    return html`<pre>
  API: ${JSON.stringify(this.schema ?? {}, null, 2)}
  Outputs: ${JSON.stringify(this.data ?? {}, null, 2)}
    </pre
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-content": BBRTContent;
  }
}
