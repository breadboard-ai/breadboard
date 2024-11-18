/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css} from 'lit';
import {AsyncDirective, directive} from 'lit/async-directive.js';
import {customElement, property} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';
import {micromark} from 'micromark';
import {gfmTable, gfmTableHtml} from 'micromark-extension-gfm-table';
import type {Extension, HtmlExtension} from 'micromark-util-types';

const MICROMARK_SETTINGS = {
  allowDangerousHtml: false,
  allowDangerousProtocol: false,
  // TODO(aomarks) Why do we need these casts, here and below? They seem
  // to be importing the same type, but maybe from different nested
  // versions?
  extensions: [gfmTable as Extension],
  htmlExtensions: [gfmTableHtml as HtmlExtension],
};

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
    // TODO(aomarks) Why does this initially display a stringified Promise?
    return !this.markdown
      ? ''
      : typeof this.markdown === 'string'
        ? unsafeHTML(micromark(this.markdown, MICROMARK_SETTINGS))
        : streamingMarkdown(this.markdown);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-markdown': BBRTMarkdown;
  }
}

const streamingMarkdown = directive(
  class StreamingMarkdownDirective extends AsyncDirective {
    override async render(stream: AsyncIterable<string>) {
      let markdown = '';
      for await (const chunk of stream) {
        markdown += chunk;
        // TODO(aomarks) micromark has a streaming mode, but only in Node.
        this.setValue(unsafeHTML(micromark(markdown, MICROMARK_SETTINGS)));
      }
    }
  },
);
