/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lit directive that renders markdown strings as HTML.
 *
 * Uses markdown-it with secure link defaults (target=_blank,
 * rel=noopener noreferrer). Shared between hivetool and web.
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

export { markdown };

class MarkdownDirective extends Directive {
  #md = MarkdownIt({ linkify: true, breaks: true });

  constructor(partInfo: PartInfo) {
    super(partInfo);
    this.#setupRules();
  }

  #setupRules() {
    const renderer = this.#md.renderer;

    const linkOriginal =
      renderer.rules["link_open"] ||
      ((tokens, idx, options, _env, self) =>
        self.renderToken(tokens, idx, options));

    renderer.rules["link_open"] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];

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
    const htmlString = this.#md.render(value);
    return unsafeHTML(htmlString);
  }
}

const markdown = directive(MarkdownDirective);
