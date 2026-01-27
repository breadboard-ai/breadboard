/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
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
import * as Sanitizer from "../../utils/sanitizer.js";

class MarkdownDirective extends Directive {
  // Maintains the map as a class property so rules can access it dynamically
  #currentTagClassMap: Record<string, string[]> = {};

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
    this.#setupDynamicClassRules();
  }

  /**
   * Sets up the rules once, reading from the #currentTagClassMap.
   */
  #setupDynamicClassRules() {
    const rulesToPatch = [
      "paragraph_open",
      "heading_open",
      "bullet_list_open",
      "ordered_list_open",
      "list_item_open",
      "link_open",
      "blockquote_open",
      "table_open",
      "tr_open",
      "td_open",
      "th_open",
      "strong_open",
      "em_open",
    ];

    const renderer = this.#markdownIt.renderer;

    for (const ruleName of rulesToPatch) {
      // Capture the original rule (or use default renderToken)
      const original =
        renderer.rules[ruleName] ||
        ((tokens, idx, options, _env, self) => {
          return self.renderToken(tokens, idx, options);
        });

      renderer.rules[ruleName] = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const classes = this.#currentTagClassMap[token.tag];
        if (classes) {
          for (const clazz of classes) {
            token.attrJoin("class", clazz);
          }
        }

        // For links, also append the _blank target and rel info.
        if (ruleName === "link_open") {
          const targetIndex = token.attrIndex("target");
          if (targetIndex < 0) {
            token.attrPush(["target", "_blank"]);
          } else {
            if (token.attrs) {
              token.attrs[targetIndex][1] = "_blank";
            }
          }

          const relIndex = token.attrIndex("rel");
          if (relIndex < 0) {
            token.attrPush(["rel", "noopener noreferrer"]);
          } else {
            if (token.attrs) {
              const currentRel = token.attrs[relIndex][1];
              if (!currentRel.includes("noopener")) {
                token.attrs[relIndex][1] = `${currentRel} noopener noreferrer`;
              }
            }
          }
        }

        return original(tokens, idx, options, env, self);
      };
    }
  }

  #lastValue: string | null = null;
  #lastTagClassMap: string | null = null;

  update(_part: Part, [value, tagClassMap]: DirectiveParameters<this>) {
    if (
      this.#lastValue === value &&
      JSON.stringify(tagClassMap) === this.#lastTagClassMap
    ) {
      return noChange;
    }

    this.#lastValue = value;
    this.#lastTagClassMap = JSON.stringify(tagClassMap);
    return this.render(value, tagClassMap);
  }

  render(value: string, tagClassMap: Record<string, string[]> = {}) {
    this.#currentTagClassMap = tagClassMap;
    const htmlString = this.#markdownIt.render(value);

    return unsafeHTML(htmlString);
  }
}

export const markdown = directive(MarkdownDirective);

const markdownItStandalone = MarkdownIt();
export function renderMarkdownToHtmlString(value: string): string {
  return markdownItStandalone.render(value);
}
