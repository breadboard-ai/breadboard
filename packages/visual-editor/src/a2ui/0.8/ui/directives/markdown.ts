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

import { noChange } from "lit";
import {
  Directive,
  DirectiveParameters,
  Part,
  PartInfo,
  directive,
} from "lit/directive.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import MarkdownIt from "markdown-it";
import * as Sanitizer from "./sanitizer.js";

class MarkdownDirective extends Directive {
  #markdownIt = MarkdownIt({
    highlight: (str, lang) => {
      switch (lang) {
        case "html": {
          const iframe = document.createElement("iframe");
          iframe.classList.add("html-view");
          iframe.srcdoc = str;
          iframe.sandbox = "";
          return iframe.innerHTML;
        }
        default:
          return Sanitizer.escapeNodeText(str);
      }
    },
  });

  constructor(partInfo: PartInfo) {
    super(partInfo);
    this.#setupRules();
  }

  /**
   * Sets up standard rules for link handling.
   */
  #setupRules() {
    const renderer = this.#markdownIt.renderer;

    const linkOriginal =
      renderer.rules["link_open"] ||
      ((tokens, idx, options, _env, self) => {
        return self.renderToken(tokens, idx, options);
      });

    renderer.rules["link_open"] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];

      // Links open in new tabs with secure defaults.
      const targetIndex = token.attrIndex("target");
      if (targetIndex < 0) {
        token.attrPush(["target", "_blank"]);
      } else if (token.attrs) {
        token.attrs[targetIndex][1] = "_blank";
      }

      const relIndex = token.attrIndex("rel");
      if (relIndex < 0) {
        token.attrPush(["rel", "noopener noreferrer"]);
      } else if (token.attrs) {
        const currentRel = token.attrs[relIndex][1];
        if (!currentRel.includes("noopener")) {
          token.attrs[relIndex][1] = `${currentRel} noopener noreferrer`;
        }
      }

      return linkOriginal(tokens, idx, options, env, self);
    };
  }

  #lastValue: string | null = null;

  update(_part: Part, [value]: DirectiveParameters<this>) {
    if (this.#lastValue === value) {
      return noChange;
    }

    this.#lastValue = value;
    return this.render(value);
  }

  render(value: string) {
    const htmlString = this.#markdownIt.render(value);
    return unsafeHTML(htmlString);
  }
}

export const markdown = directive(MarkdownDirective);

const markdownItStandalone = MarkdownIt();
export function renderMarkdownToHtmlString(value: string): string {
  return markdownItStandalone.render(value);
}
