/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { SignalSet } from "signal-utils/set";
import type { BBRTTool } from "../tools/tool.js";

@customElement("bbrt-tool-palette")
export class BBRTToolPalette extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  availableTools?: SignalSet<BBRTTool>;

  @property({ attribute: false })
  activeToolIds?: SignalSet<string>;

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
    img {
      height: 16px;
      max-width: 16px;
    }
    .active > a {
      color: #008dff;
    }
  `;

  override render() {
    if (this.availableTools === undefined) {
      return nothing;
    }
    return html`
      <ul>
        ${[...this.availableTools].map(this.#renderTool)}
      </ul>
    `;
  }

  #renderTool = (tool: BBRTTool) => html`
    <li
      class=${classMap({
        active: this.activeToolIds?.has(tool.metadata.id) ?? false,
      })}
    >
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
    if (this.activeToolIds === undefined) {
      return;
    }
    const id = tool.metadata.id;
    if (this.activeToolIds.has(id)) {
      this.activeToolIds.delete(id);
    } else {
      this.activeToolIds.add(id);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-tool-palette": BBRTToolPalette;
  }
}
