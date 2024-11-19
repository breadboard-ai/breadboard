/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {asyncReplace} from 'lit/directives/async-replace.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {micromark} from 'micromark';
import {gfmTable, gfmTableHtml} from 'micromark-extension-gfm-table';
import type {Extension, HtmlExtension} from 'micromark-util-types';

@customElement('bbrt-markdown')
export class BBRTMarkdown extends LitElement {
  @property()
  markdown?: string | AsyncIterable<string>;

  static override styles = css`
    :first-child {
      margin-top: 0;
    }
  `;
  render() {
    return !this.markdown
      ? nothing
      : typeof this.markdown === 'string'
        ? renderMarkdown(this.markdown)
        : asyncReplace(renderMarkdownStreaming(this.markdown));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-markdown': BBRTMarkdown;
  }
}

const MICROMARK_SETTINGS = {
  allowDangerousHtml: false,
  allowDangerousProtocol: false,
  // TODO(aomarks) Why do we need these casts, here and below? They seem
  // to be importing the same type, but maybe from different nested
  // versions?
  // TODO(aomarks) The table extension doesn't seem to be working.
  extensions: [gfmTable as Extension],
  htmlExtensions: [gfmTableHtml as HtmlExtension],
};

function renderMarkdown(markdown: string) {
  return unsafeHTML(micromark(markdown, MICROMARK_SETTINGS));
}

async function* renderMarkdownStreaming(
  stream: AsyncIterable<string>,
): AsyncIterable<unknown> {
  // TODO(aomarks) Yield something right away so that asyncReplace clears the
  // previous part when switching to a new source to render. Check if there is a
  // more elegant solution.
  yield '';
  let markdown = '';
  for await (const chunk of stream) {
    markdown += chunk;
    // TODO(aomarks) micromark has a streaming mode, but only in Node. We need a
    // streaming Markdown parser.
    yield renderMarkdown(markdown);
  }
}
