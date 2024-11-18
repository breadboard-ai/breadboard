/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {LitElement, css, html} from 'lit';
import {customElement} from 'lit/decorators.js';
import {getWikipediaArticle} from '../tools/wikipedia.js';

export interface Tool {
  icon: string;
}

@customElement('bbrt-tool-belt')
export class BBRTToolBelt extends LitElement {
  tools: Tool[] = [getWikipediaArticle];

  static override styles = css`
    :host {
      display: flex;
      justify-content: flex-start;
      align-items: flex-start;
      padding-left: 24px;
    }
    img {
      width: 40px;
      height: auto;
    }
  `;

  override render() {
    return this.tools.map((tool) => html`<img src=${tool.icon} />`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bbrt-tool-belt': BBRTToolBelt;
  }
}
