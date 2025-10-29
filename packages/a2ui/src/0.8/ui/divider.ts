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

import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { Root } from "./root.js";
import { styleMap } from "lit/directives/style-map.js";
import { classMap } from "lit/directives/class-map.js";
import { structuralStyles } from "./styles.js";

@customElement("a2ui-divider")
export class Divider extends Root {
  static styles = [
    structuralStyles,
    css`
      :host {
        display: block;
        min-height: 0;
        overflow: auto;
      }

      hr {
        height: 1px;
        background: #ccc;
        border: none;
      }
    `,
  ];

  render() {
    return html`<hr
      class=${classMap(this.theme.components.Divider)}
      style=${this.theme.additionalStyles?.Divider
        ? styleMap(this.theme.additionalStyles?.Divider)
        : nothing}
    />`;
  }
}
