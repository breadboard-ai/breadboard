/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@google-labs/breadboard";
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AsyncComputed } from "signal-utils/async-computed";
import { BBRTAppState } from "../app-state.js";
import { BreadboardToolProvider } from "../breadboard/breadboard-tool-provider.js";
import { BreadboardTool } from "../breadboard/breadboard-tool.js";
import { readBoardServersFromIndexedDB } from "../breadboard/indexed-db-servers.js";
import type { Config } from "../config.js";
import { ActivateTool } from "../tools/activate-tool.js";
import { BoardLister } from "../tools/list-tools.js";
import type { BBRTTool } from "../tools/tool.js";
import { connectedEffect } from "../util/connected-effect.js";
import "./board-visualizer.js";
import "./chat.js";
import "./driver-selector.js";
import "./prompt.js";
import "./tool-palette.js";

const APP_STATE_SESSION_STORAGE_KEY = "bbrt-app-state-v1";

@customElement("bbrt-main")
export class BBRTMain extends SignalWatcher(LitElement) {
  @property({ type: Object })
  config?: Config;

  readonly #state = new BBRTAppState();

  readonly #displayedBoard = new AsyncComputed<GraphDescriptor | undefined>(
    async () => {
      // TODO(aomarks) This is just a temporary way to get some kind of relevant
      // graph to render, to prove that rendering is working OK. Eventually this
      // would render a board being built from the conversation.
      let boardTool: BreadboardTool | undefined;
      for (const tool of this.#state.activeTools.get()) {
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

  static override styles = css`
    :host {
      display: grid;
      grid-template-areas:
        "sidebar chatlog artifacts"
        "sidebar chatlog artifacts"
        "sidebar inputs  artifacts";
      grid-template-columns: 300px 1fr 1fr;
      grid-template-rows: 1fr min-content;
    }
    bbrt-tool-palette {
      grid-area: sidebar;
      overflow-y: auto;
      border-right: 1px solid #ccc;
    }
    bbrt-chat {
      grid-area: chatlog;
      overflow-y: auto;
    }
    #inputs {
      grid-area: inputs;
      display: flex;
      padding: 24px;
      border-top: 1px solid #ccc;
    }
    bbrt-prompt {
      flex-grow: 1;
    }
    bbrt-board-visualizer {
      grid-area: artifacts;
      border-left: 1px solid #ccc;
      overflow: hidden;
    }
    #toggle-components {
      background: oklch(from var(--bb-neutral-0) l c h/0.22)
        var(--bb-icon-extension-inverted) center center / 24px 24px no-repeat;
    }
  `;

  constructor() {
    super();
    void this.#firstBoot();
  }

  async #firstBoot() {
    await this.#loadAllTools();
    this.#restoreState();
    connectedEffect(this, () => this.#persistState());
  }

  #restoreState() {
    const serialized = sessionStorage.getItem(APP_STATE_SESSION_STORAGE_KEY);
    if (serialized !== null) {
      const parsed = JSON.parse(serialized);
      console.log("Restoring state", parsed);
      this.#state.restore(parsed);
    }
  }

  #persistState() {
    const state = this.#state.serialize();
    const serialized = JSON.stringify(state, null, 2);
    console.log("Persisting state", serialized);
    try {
      sessionStorage.setItem(APP_STATE_SESSION_STORAGE_KEY, serialized);
    } catch (error) {
      console.error("Failed to persist state", error);
    }
  }

  override render() {
    return html`
      <div id="inputs">
        <bbrt-driver-selector
          .available=${this.#state.drivers}
          .active=${this.#state.activeDriver}
        ></bbrt-driver-selector>
        <bbrt-prompt .conversation=${this.#state.conversation}></bbrt-prompt>
      </div>

      <bbrt-chat .conversation=${this.#state.conversation}></bbrt-chat>

      <bbrt-tool-palette
        .availableTools=${this.#state.availableTools}
        .activeToolIds=${this.#state.activeToolIds}
      ></bbrt-tool-palette>

      <bbrt-board-visualizer
        .graph=${this.#displayedBoard.get()}
      ></bbrt-board-visualizer>
    `;
  }

  async #loadAllTools() {
    const servers = await readBoardServersFromIndexedDB();
    if (!servers.ok) {
      console.error(
        "Failed to read board servers from IndexedDB:",
        servers.error
      );
      return;
    }

    const boardLister = new BoardLister(servers.value);
    // TODO(aomarks) Casts should not be needed. Something to do with the
    // default parameter being unknown instead of any.
    this.#state.availableTools.add(boardLister as BBRTTool);
    this.#state.activeToolIds.add(boardLister.metadata.id);

    const toolActivator = new ActivateTool(
      this.#state.toolProviders,
      this.#state.availableTools
    );
    this.#state.availableTools.add(toolActivator as BBRTTool);
    this.#state.activeToolIds.add(toolActivator.metadata.id);

    for (const server of servers.value) {
      const provider = new BreadboardToolProvider(
        server,
        this.#state.secrets,
        this.#state.artifactStore
      );
      this.#state.toolProviders.push(provider);
      for (const tool of await provider.tools()) {
        this.#state.availableTools.add(tool);
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-main": BBRTMain;
  }
}
