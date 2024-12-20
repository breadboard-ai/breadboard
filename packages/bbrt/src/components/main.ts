/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  ArtifactStore,
  artifactStoreContext,
} from "../artifacts/artifact-store.js";
import { IdbArtifactReaderWriter } from "../artifacts/idb-artifact-reader-writer.js";
import { BreadboardTool } from "../breadboard/breadboard-tool.js";
import { readBoardServersFromIndexedDB } from "../breadboard/indexed-db-servers.js";
import type { Config } from "../config.js";
import type { BBRTDriver } from "../drivers/driver-interface.js";
import { GeminiDriver } from "../drivers/gemini.js";
import { OpenAiDriver } from "../drivers/openai.js";
import { Conversation } from "../llm/conversation.js";
import { BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION } from "../llm/system-instruction.js";
import { IndexedDBSettingsSecrets } from "../secrets/indexed-db-secrets.js";
import { ReactiveSessionBriefState } from "../state/session-brief.js";
import { ReactiveSessionEventState } from "../state/session-event.js";
import { ReactiveSessionState } from "../state/session.js";
import { ActivateTool } from "../tools/activate-tool.js";
import { AddNode } from "../tools/add-node.js";
import { CreateBoard } from "../tools/create-board.js";
import { DisplayArtifact } from "../tools/display-artifact.js";
import { BoardLister } from "../tools/list-tools.js";
import { type BBRTTool } from "../tools/tool-types.js";
import { connectedEffect } from "../util/connected-effect.js";
import "./artifact-display.js";
import "./chat.js";
import "./driver-selector.js";
import "./prompt.js";
import "./tool-palette.js";

const APP_STATE_SESSION_STORAGE_KEY = "bbrt-app-state-v2";

@customElement("bbrt-main")
export class BBRTMain extends SignalWatcher(LitElement) {
  @property({ type: Object })
  accessor config: Config | undefined = undefined;
  readonly #secrets = new IndexedDBSettingsSecrets();
  readonly #state: ReactiveSessionState;
  readonly #conversation: Conversation;

  // TODO(aomarks) Due to the bug https://github.com/lit/lit/issues/4675, when
  // using standard decorators, context provider initialization must be done in
  // the constructor.
  @provide({ context: artifactStoreContext })
  accessor #artifacts: ArtifactStore;

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

    this.#artifacts = new ArtifactStore(new IdbArtifactReaderWriter());

    const serializedState = sessionStorage.getItem(
      APP_STATE_SESSION_STORAGE_KEY
    );
    // TODO(aomarks) Support multiple sessions.
    const temporarySingletonBrief = new ReactiveSessionBriefState({
      id: "main",
      title: "Main",
    });
    if (serializedState) {
      const parsed = JSON.parse(serializedState);
      console.log("Restoring state", parsed);
      this.#state = new ReactiveSessionState(parsed, temporarySingletonBrief);
    } else {
      this.#state = new ReactiveSessionState(
        { id: "main", events: [] },
        temporarySingletonBrief
      );
    }

    const drivers = new Map<string, BBRTDriver>(
      [
        new GeminiDriver(() => this.#secrets.getSecret("GEMINI_API_KEY")),
        new OpenAiDriver(() => this.#secrets.getSecret("OPENAI_API_KEY")),
      ].map((driver) => [driver.id, driver])
    );
    const breadboardToolsPromise = this.#loadBreadboardTools();
    const standardTools: BBRTTool[] = [
      new BoardLister(breadboardToolsPromise),
      new ActivateTool(
        breadboardToolsPromise.then(
          (tools) => new Set(tools.map((tool) => tool.metadata.id))
        ),
        this.#state
      ),
      new CreateBoard(this.#artifacts),
      new AddNode(this.#artifacts),
      new DisplayArtifact((artifactId) => {
        this.#state.activeArtifactId = artifactId;
        return { ok: true, value: undefined };
      }),
    ];
    const availableToolsPromise = breadboardToolsPromise.then(
      (breadboardTools) =>
        new Map(
          [...standardTools, ...breadboardTools].map((tool) => [
            tool.metadata.id,
            tool,
          ])
        )
    );

    this.#conversation = new Conversation({
      state: this.#state,
      drivers,
      availableToolsPromise,
    });

    if (!serializedState) {
      const timestamp = Date.now();
      this.#state.events.push(
        // TODO(aomarks) Helpers, this is mostly boilerplate.
        new ReactiveSessionEventState({
          timestamp,
          id: crypto.randomUUID(),
          detail: {
            kind: "set-system-prompt",
            systemPrompt: BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION,
          },
        }),
        new ReactiveSessionEventState({
          timestamp,
          id: crypto.randomUUID(),
          detail: {
            kind: "set-active-tool-ids",
            toolIds: standardTools.map((tool) => tool.metadata.id),
          },
        }),
        // TODO(aomarks) Before the first turn is when we should expect some
        // churn in settings. But only the most recent event can get
        // efficiently in-place updated. If we had a single "set-config"
        // event with optional fields, we could get rid of all that churn.
        new ReactiveSessionEventState({
          timestamp,
          id: crypto.randomUUID(),
          detail: {
            kind: "set-driver",
            driverId: drivers.keys().next().value!,
          },
        })
      );
    }

    connectedEffect(this, () => this.#persistState());
    connectedEffect(this, () => {
      console.log(JSON.stringify(this.#state.data, null, 2));
    });
  }

  #persistState() {
    const serialized = JSON.stringify(this.#state.data, null, 2);
    try {
      sessionStorage.setItem(APP_STATE_SESSION_STORAGE_KEY, serialized);
    } catch (error) {
      console.error("Failed to persist state", error);
    }
  }

  override render() {
    const artifactId = this.#state.activeArtifactId;
    const artifact = artifactId ? this.#artifacts.entry(artifactId) : undefined;
    return html`
      <div id="inputs">
        <bbrt-driver-selector
          .conversation=${this.#conversation}
        ></bbrt-driver-selector>
        <bbrt-prompt .conversation=${this.#conversation}></bbrt-prompt>
      </div>

      <bbrt-chat .conversation=${this.#conversation}></bbrt-chat>

      <bbrt-tool-palette
        .conversation=${this.#conversation}
      ></bbrt-tool-palette>

      <bbrt-artifact-display .artifact=${artifact}></bbrt-artifact-display>
    `;
  }

  async #loadBreadboardTools(): Promise<BBRTTool[]> {
    const tools: BBRTTool[] = [];
    const servers = await readBoardServersFromIndexedDB();
    if (!servers.ok) {
      console.error(
        "Failed to read board servers from IndexedDB:",
        servers.error
      );
    } else {
      for (const server of servers.value) {
        const boards = await server.boards();
        if (!boards.ok) {
          console.error(
            `Failed to read boards from server ${server.url}:`,
            boards.error
          );
          continue;
        }
        for (const board of boards.value) {
          const tool = new BreadboardTool(
            board,
            server,
            this.#secrets,
            this.#artifacts
          );
          tools.push(tool);
        }
      }
    }
    return tools;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-main": BBRTMain;
  }
}
