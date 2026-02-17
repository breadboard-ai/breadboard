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
import { customElement, property } from "lit/decorators.js";
import { markdown } from "./directives/directives.js";
import { Root } from "./root.js";
import { StringValue } from "../types/primitives.js";
import { ResolvedText } from "../types/types.js";
import { extractStringValue } from "./utils/utils.js";

/**
 * Renders text content with markdown support.
 *
 * Resolves its `text` property (a `StringValue`) from either a literal value
 * or a data binding path, then passes it through the `markdown` directive for
 * rendering. The `usageHint` property controls typographic styling via
 * host-attribute selectors (h1–h5, caption, body).
 */
@customElement("a2ui-text")
export class Text extends Root {
  @property()
  accessor text: StringValue | null = null;

  @property()
  accessor usageHint: ResolvedText["usageHint"] | null = null;

  static styles = [
    css`
      :host {
        display: block;
        flex: var(--weight);
        padding: var(--a2ui-text-padding, 0);
      }

      section {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: var(--a2ui-spacing-2);
      }

      /* Usage-hint variants applied via host attribute */
      :host([usage-hint="h1"]) section {
        font-family: var(--a2ui-font-family-flex);
        text-align: center;
        font-variation-settings: "ROND" 100;
        font-weight: 500;
        margin: 0;
        font-size: 24px;
        line-height: 32px;
        font-style: normal;
        align-self: normal;
        margin-bottom: var(--a2ui-spacing-2);
      }

      :host([usage-hint="h2"]) section,
      :host([usage-hint="h3"]) section,
      :host([usage-hint="h4"]) section,
      :host([usage-hint="h5"]) section {
        font-family: var(--a2ui-font-family-flex);
        text-align: center;
        font-variation-settings: "ROND" 100;
        font-weight: 400;
        margin: 0;
        color: var(--a2ui-color-secondary);
      }

      :host([usage-hint="h2"]) section {
        font-size: 22px;
        line-height: 28px;
      }

      :host([usage-hint="h3"]) section {
        font-size: 14px;
        line-height: 20px;
      }

      :host([usage-hint="h4"]) section {
        font-size: 16px;
        line-height: 24px;
      }

      :host([usage-hint="h5"]) section {
        font-size: 14px;
        line-height: 20px;
      }

      :host([usage-hint="caption"]) section,
      :host([usage-hint="body"]) section {
        color: var(--a2ui-color-secondary);
      }

      /* Markdown element styles — these apply to elements rendered by
         the markdown directive inside the shadow DOM */
      p,
      ol,
      ul,
      li {
        font-family: var(--a2ui-font-family);
        font-style: normal;
        font-weight: 400;
        margin: 0;
        font-size: 14px;
        line-height: 20px;
        align-self: normal;
      }

      li {
        margin-bottom: var(--a2ui-spacing-3);
      }

      p {
        white-space: pre-line;
      }

      h1 {
        font-family: var(--a2ui-font-family-flex);
        font-style: normal;
        font-weight: 500;
        margin: 0 0 var(--a2ui-spacing-2) 0;
        font-size: 22px;
        line-height: 28px;
      }

      h2 {
        font-family: var(--a2ui-font-family-flex);
        font-style: normal;
        font-weight: 500;
        margin: 0 0 var(--a2ui-spacing-2) 0;
        font-size: 16px;
        line-height: 24px;
      }

      h3 {
        font-family: var(--a2ui-font-family-flex);
        font-style: normal;
        font-weight: 500;
        margin: 0 0 var(--a2ui-spacing-2) 0;
        font-size: 14px;
        line-height: 20px;
      }

      a {
        font-family: var(--a2ui-font-family-flex);
        font-style: normal;
        font-weight: 500;
        align-self: normal;
        display: inline-flex;
        align-items: center;
      }

      pre {
        font-family: var(--a2ui-font-family-mono);
        font-style: normal;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        white-space: pre-line;
        align-self: normal;
      }
    `,
  ];

  #renderText() {
    let text = extractStringValue(
      this.text,
      this.component,
      this.processor,
      this.surfaceId
    );

    if (!text) {
      return html``;
    }

    switch (this.usageHint) {
      case "h1":
        text = `# ${text}`;
        break;
      case "h2":
        text = `## ${text}`;
        break;
      case "h3":
        text = `### ${text}`;
        break;
      case "h4":
        text = `#### ${text}`;
        break;
      case "h5":
        text = `##### ${text}`;
        break;
      case "caption":
        text = `*${text}*`;
        break;
      default:
        break; // Body.
    }

    return html`${markdown(text)}`;
  }

  render() {
    // Reflect usage-hint as attribute for CSS host-context styling
    if (this.usageHint) {
      this.setAttribute("usage-hint", this.usageHint);
    } else {
      this.removeAttribute("usage-hint");
    }

    return html`<section>${this.#renderText()}</section>`;
  }
}
