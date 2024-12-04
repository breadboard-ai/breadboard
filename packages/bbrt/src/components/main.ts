/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard";
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Signal } from "signal-polyfill";
import { SignalArray } from "signal-utils/array";
import { AsyncComputed } from "signal-utils/async-computed";
import { SignalSet } from "signal-utils/set";
import { BreadboardToolProvider } from "../breadboard/breadboard-tool-provider.js";
import { BreadboardTool } from "../breadboard/breadboard-tool.js";
import { readBoardServersFromIndexedDB } from "../breadboard/indexed-db-servers.js";
import type { Config } from "../config.js";
import type { BBRTDriver } from "../drivers/driver-interface.js";
import { GeminiDriver } from "../drivers/gemini.js";
import { OpenAiDriver } from "../drivers/openai.js";
import { BBRTConversation } from "../llm/conversation.js";
import { IndexedDBSettingsSecrets } from "../secrets/indexed-db-secrets.js";
import { ActivateTool } from "../tools/activate-tool.js";
import { BoardLister } from "../tools/list-tools.js";
import { ToolProvider } from "../tools/tool-provider.js";
import type { BBRTTool } from "../tools/tool.js";
import "./board-visualizer.js";
import "./chat.js";
import "./driver-selector.js";
import "./prompt.js";
import "./tool-palette.js";

@customElement("bbrt-main")
export class BBRTMain extends SignalWatcher(LitElement) {
  @property({ type: Object })
  config?: Config;

  readonly #secrets = new IndexedDBSettingsSecrets();
  readonly #drivers = [
    new GeminiDriver(() => this.#secrets.getSecret("GEMINI_API_KEY")),
    new OpenAiDriver(() => this.#secrets.getSecret("OPENAI_API_KEY")),
  ];
  readonly #activeDriver = new Signal.State<BBRTDriver>(this.#drivers[0]!);
  readonly #toolProviders = new SignalArray<ToolProvider>();
  readonly #activeTools = new SignalSet<BBRTTool>();
  readonly #conversation = new BBRTConversation(
    this.#activeDriver,
    this.#activeTools
  );
  readonly #displayedBoard = new AsyncComputed<GraphDescriptor | undefined>(
    async () => {
      // TODO(aomarks) This is just a temporary way to get some kind of relevant
      // graph to render, to prove that rendering is working OK. Eventually this
      // would render a board being built from the conversation.
      let boardTool: BreadboardTool | undefined;
      for (const tool of this.#activeTools) {
        if (tool instanceof BreadboardTool) {
          boardTool = tool;
        }
      }
      if (boardTool === undefined) {
        return undefined;
      }
      const bgl = await boardTool.bgl();
      if (!bgl.ok) {
        return undefined;
      }
      return bgl.value;
    }
  );

  @state()
  private _sidePanelOpen = true;

  static override styles = css`
    :host {
      --sidebar-width: 350px;
    }
    #container {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-columns: 2fr 0;
      grid-template-rows: 1fr auto;
    }
    #container.sidePanelOpen {
      grid-template-columns: 2fr var(--sidebar-width);
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
      display: grid;
      grid-template-rows: 1fr var(--sidebar-width);
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
    bbrt-tool-palette {
      overflow-y: scroll;
    }
    bbrt-board-visualizer {
      border-top: 1px solid #ccc;
      width: var(--sidebar-width);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.#discoverToolProviders();
  }

  override render() {
    return html`
      <div
        id="container"
        class=${classMap({ sidePanelOpen: this._sidePanelOpen })}
      >
        <bbrt-chat .conversation=${this.#conversation}></bbrt-chat>
        <div id="bottom">
          <div id="inputs">
            <bbrt-driver-selector
              .available=${this.#drivers}
              .active=${this.#activeDriver}
            ></bbrt-driver-selector>
            <bbrt-prompt .conversation=${this.#conversation}></bbrt-prompt>
          </div>
        </div>
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
        <div id="sidebar">${this.#renderSidebarContents()}</div>
      </div>
    `;
  }

  #clickExpandSidebar() {
    this._sidePanelOpen = !this._sidePanelOpen;
  }

  #renderSidebarContents() {
    if (!this._sidePanelOpen) {
      return nothing;
    }

    return [
      html`
        <bbrt-tool-palette
          .toolProviders=${this.#toolProviders}
          .activeTools=${this.#activeTools}
        ></bbrt-tool-palette>
      `,

      html`
        <bbrt-board-visualizer
          .graph=${this.#displayedBoard.get()}
        ></bbrt-board-visualizer>
      `,
    ];
  }

  async #discoverToolProviders() {
    const servers = await readBoardServersFromIndexedDB();
    if (!servers.ok) {
      console.error(
        "Failed to read board servers from IndexedDB:",
        servers.error
      );
      return;
    }
    this.#toolProviders.length = 0;
    this.#toolProviders.push(
      ...servers.value.map(
        (server) => new BreadboardToolProvider(server, this.#secrets)
      )
    );
    this.#activeTools.clear();
    // TODO(aomarks) Casts should not be needed. Something to do with the
    // default parameter being unknown instead of any.
    this.#activeTools.add(new BoardLister(servers.value) as BBRTTool);
    this.#activeTools.add(
      new ActivateTool(this.#toolProviders, this.#activeTools) as BBRTTool
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-main": BBRTMain;
  }
}
