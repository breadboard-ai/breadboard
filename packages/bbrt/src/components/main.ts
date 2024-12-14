/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BBRTAppState } from "../app-state.js";
import { BreadboardToolProvider } from "../breadboard/breadboard-tool-provider.js";
import { readBoardServersFromIndexedDB } from "../breadboard/indexed-db-servers.js";
import type { Config } from "../config.js";
import { ActivateTool } from "../tools/activate-tool.js";
import { AddNode } from "../tools/add-node.js";
import { CreateBoard } from "../tools/create-board.js";
import { DisplayArtifact } from "../tools/display-artifact.js";
import { BoardLister } from "../tools/list-tools.js";
import type { BBRTTool } from "../tools/tool.js";
import { connectedEffect } from "../util/connected-effect.js";
import "./artifact-display.js";
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
    bbrt-artifact-display {
      grid-area: artifacts;
      border-left: 1px solid #ccc;
      overflow: hidden;
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

      <bbrt-artifact-display
        .artifact=${this.#state.activeArtifact}
      ></bbrt-artifact-display>
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
      this.#state.availableTools,
      this.#state.activeToolIds
    );
    this.#state.availableTools.add(toolActivator as BBRTTool);
    this.#state.activeToolIds.add(toolActivator.metadata.id);

    const boardCreator = new CreateBoard(this.#state.artifacts);
    this.#state.availableTools.add(boardCreator as BBRTTool);
    this.#state.activeToolIds.add(boardCreator.metadata.id);

    const nodeAdder = new AddNode(this.#state.artifacts);
    this.#state.availableTools.add(nodeAdder as BBRTTool);
    this.#state.activeToolIds.add(nodeAdder.metadata.id);

    const artifactDisplayer = new DisplayArtifact((artifactId) => {
      this.#state.activeArtifactId.set(artifactId);
      return { ok: true, value: undefined };
    });
    this.#state.availableTools.add(artifactDisplayer as BBRTTool);
    this.#state.activeToolIds.add(artifactDisplayer.metadata.id);

    for (const server of servers.value) {
      const provider = new BreadboardToolProvider(
        server,
        this.#state.secrets,
        this.#state.artifacts
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
