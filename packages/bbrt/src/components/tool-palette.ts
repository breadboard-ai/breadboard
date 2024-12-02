/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { SignalArray } from "signal-utils/array";
import type { SignalSet } from "signal-utils/set";
import type { ToolProvider } from "../tools/tool-provider.js";
import type { BBRTTool } from "../tools/tool.js";

@customElement("bbrt-tool-palette")
export class BBRTToolPalette extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  toolProviders?: SignalArray<ToolProvider>;

  @property({ attribute: false })
  activeTools?: SignalSet<BBRTTool>;

  static override styles = css`
    :host {
      display: block;
      padding: 24px;
      font-family: Helvetica, sans-serif;
    }
    ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    li {
      margin: 0.2em 0;
    }
    a {
      text-decoration: none;
      color: #6c80a0;
      font-size: 0.85em;
    }
    a:hover {
      color: #498fff;
    }
    :first-child {
      margin-top: 0;
    }
    h3 {
      font-weight: normal;
      color: #666;
    }
    img {
      height: 16px;
      max-width: 16px;
    }
    .active > a {
      color: #008dff;
    }
  `;

  override render() {
    if (this.toolProviders === undefined) {
      return nothing;
    }
    return html`
      <ul>
        ${this.toolProviders.map(this.#renderProviders)}
      </ul>
    `;
  }

  #renderProviders = (provider: ToolProvider) => html`
    <h3>${provider.name}</h3>
    <ul>
      ${provider.tools().map(this.#renderTool)}
    </ul>
  `;

  #renderTool = (tool: BBRTTool) => html`
    <li class=${classMap({ active: this.activeTools?.has(tool) ?? false })}>
      <a href="#" @click=${(event: MouseEvent) => this.#clickTool(event, tool)}>
        ${tool.metadata.icon
          ? html`<img src=${tool.metadata.icon} alt="" />`
          : nothing}
        ${tool.metadata.title}
      </a>
    </li>
  `;

  #clickTool(event: MouseEvent, tool: BBRTTool) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.activeTools === undefined) {
      return;
    }
    if (this.activeTools.has(tool)) {
      this.activeTools.delete(tool);
    } else {
      this.activeTools.add(tool);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-tool-palette": BBRTToolPalette;
  }
}
