/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { asyncReplace } from "lit/directives/async-replace.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

@customElement("bbrt-markdown")
export class BBRTMarkdown extends LitElement {
  @property()
  accessor markdown: string | AsyncIterable<string> | undefined = undefined;

  static override styles = css`
    :host {
      line-height: 1.4;
      color: #222;
    }
    :first-child {
      margin-top: 0;
    }
    ol,
    ul {
      /* The default chrome value is 40px, which is weird since it doesn't scale
      with font-size. */
      padding-inline-start: 2.5em;
    }
  `;
  render() {
    return !this.markdown
      ? nothing
      : typeof this.markdown === "string"
        ? renderMarkdown(this.markdown)
        : asyncReplace(renderMarkdownStreaming(this.markdown));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-markdown": BBRTMarkdown;
  }
}

const MICROMARK_SETTINGS = {
  allowDangerousHtml: false,
  allowDangerousProtocol: false,
  extensions: [gfm()],
  htmlExtensions: [gfmHtml()],
};

function renderMarkdown(markdown: string) {
  return unsafeHTML(micromark(markdown, MICROMARK_SETTINGS));
}

async function* renderMarkdownStreaming(
  stream: AsyncIterable<string>
): AsyncIterable<unknown> {
  // TODO(aomarks) Yield something right away so that asyncReplace clears the
  // previous part when switching to a new source to render. Check if there is a
  // more elegant solution.
  yield "";
  let markdown = "";
  for await (const chunk of stream) {
    markdown += chunk;
    // TODO(aomarks) micromark has a streaming mode, but only in Node. We need a
    // streaming Markdown parser.
    yield renderMarkdown(markdown);
  }
}
