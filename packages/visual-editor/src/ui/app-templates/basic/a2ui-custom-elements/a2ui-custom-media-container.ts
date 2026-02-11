/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as A2UI from "../../../../a2ui/index.js";
import { html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("a2ui-custom-media-container")
export class A2UICustomMediaContainer extends A2UI.v0_8.UI.Root {
  static styles = [
    css`
      :host {
        display: block;
      }

      section {
        width: 70%;
        max-width: 70%;
        margin: 0 auto;
      }
    `,
  ];

  render() {
    return html`<section>
      <slot></slot>
    </section>`;
  }
}
