/*
 Copyright 2025 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root.js";

/**
 * Visual separator component.
 *
 * Renders 1px horizontal rule using the `--a2ui-color-border` token.
 */
@customElement("a2ui-divider")
export class Divider extends Root {
  static styles = [
    css`
      :host {
        display: block;
        min-height: 0;
        overflow: hidden;
      }

      hr {
        height: 1px;
        background: var(--a2ui-color-border);
        border: none;
      }
    `,
  ];

  render() {
    return html`<hr />`;
  }
}
