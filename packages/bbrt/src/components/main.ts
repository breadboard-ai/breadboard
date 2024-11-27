/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Signal } from "signal-polyfill";
import { SignalArray } from "signal-utils/array";
import { SignalSet } from "signal-utils/set";
import { BreadboardServer } from "../breadboard/breadboard-server.js";
import { BreadboardToolProvider } from "../breadboard/breadboard-tool-provider.js";
import type { Config } from "../config.js";
import { BBRTConversation } from "../llm/conversation.js";
import type { BBRTModel } from "../llm/model.js";
import { BREADBOARD_SERVER } from "../secrets.js";
import { IndexedDBSettingsSecrets } from "../secrets/indexed-db-secrets.js";
import { ToolProvider } from "../tools/tool-provider.js";
import type { BBRTTool } from "../tools/tool.js";
import "./chat.js";
import "./model-selector.js";
import "./prompt.js";
import "./tool-palette.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bbrt-main")
export class BBRTMain extends LitElement {
  @property({ type: Object })
  config?: Config;

  #model = new Signal.State<BBRTModel>("gemini");
  #activeTools = new SignalSet<BBRTTool>();
  #secrets = new IndexedDBSettingsSecrets();
  #conversation = new BBRTConversation(
    this.#model,
    this.#activeTools,
    this.#secrets
  );
  @state()
  private _sidePanelOpen = false;

  #toolProviders = new SignalArray<ToolProvider>([
    // TODO(aomarks) Support having multiple breadboard servers active.
    new BreadboardToolProvider(
      new BreadboardServer(BREADBOARD_SERVER),
      this.#secrets
    ),
  ]);

  static override styles = css`
    #container {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-columns: 2fr 0;
      grid-template-rows: 1fr auto;
    }
    #container.sidePanelOpen {
      grid-template-columns: 2fr 350px;
    }
    bbrt-chat {
      grid-column: 1;
      grid-row: 1 / 2;
    }
    #bottom {
      padding: 24px;
      border-top: 1px solid #ccc;
      grid-column: 1;
      grid-row: 2;
    }
    #inputs {
      display: flex;
    }
    bbrt-prompt {
      flex-grow: 1;
    }
    #sidebar {
      grid-column: 2;
      grid-row: 1 / 3;
      border-left: 1px solid #ccc;
      overflow-y: auto;
    }
    #expandSidebarButton {
      position: fixed;
      top: 12px;
      right: 16px;
      height: 48px;
      width: 48px;
      background: none;
      border: none;
      cursor: pointer;
    }
  `;

  override render() {
    return html`
      <div
        id="container"
        class=${classMap({ sidePanelOpen: this._sidePanelOpen })}
      >
        <bbrt-chat
          .conversation=${this.#conversation}
          .secrets=${this.#secrets}
        ></bbrt-chat>
        <div id="bottom">
          <div id="inputs">
            <bbrt-model-selector .model=${this.#model}></bbrt-model-selector>
            <bbrt-prompt .conversation=${this.#conversation}></bbrt-prompt>
          </div>
        </div>
        <div id="sidebar">
          <button id="expandSidebarButton" @click=${this.#clickExpandSidebar}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#5f6368"
            >
              <path
                d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"
              />
            </svg>
          </button>
          <bbrt-tool-palette
            .toolProviders=${this.#toolProviders}
            .activeTools=${this.#activeTools}
          ></bbrt-tool-palette>
        </div>
      </div>
    `;
  }

  #clickExpandSidebar() {
    this._sidePanelOpen = !this._sidePanelOpen;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-main": BBRTMain;
  }
}
