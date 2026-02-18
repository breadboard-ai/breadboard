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
import { customElement, property } from "lit/decorators.js";
import { Root } from "./root.js";
import { StringValue } from "../types/primitives.js";
import { extractStringValue } from "./utils/utils.js";
import { icons } from "../styles/icons.js";

/**
 * Material icon component.
 *
 * Resolves an icon name from a `StringValue` using `extractStringValue`,
 * normalizes PascalCase to snake_case, and renders it via the Material
 * Symbols font.
 */
@customElement("a2ui-icon")
export class Icon extends Root {
  @property()
  accessor name: StringValue | null = null;

  static styles = [
    icons,
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
    `,
  ];

  #renderIcon() {
    const iconName = extractStringValue(
      this.name,
      this.component,
      this.processor,
      this.surfaceId
    );

    if (!iconName) {
      return nothing;
    }

    const normalizedName = iconName
      .replace(/([A-Z])/gm, "_$1")
      .toLocaleLowerCase();
    return html`<span class="g-icon">${normalizedName}</span>`;
  }

  render() {
    return html`<section>${this.#renderIcon()}</section>`;
  }
}
