/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { AsyncComputed } from "signal-utils/async-computed";
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
import type { ForkEvent } from "../llm/fork.js";
import { BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION } from "../llm/system-instruction.js";
import { IndexedDBSettingsSecrets } from "../secrets/indexed-db-secrets.js";
import type { SecretsProvider } from "../secrets/secrets-provider.js";
import { ReactiveAppState } from "../state/app.js";
import { LocalStoragePersistence } from "../state/local-storage-persistence.js";
import type { Persistence } from "../state/persistence.js";
import { SessionStore } from "../state/session-store.js";
import type { ReactiveSessionState } from "../state/session.js";
import { ActivateTool } from "../tools/activate-tool.js";
import { AddNode } from "../tools/add-node.js";
import { CreateBoard } from "../tools/create-board.js";
import { DisplayFile } from "../tools/files/display-file.js";
import { ReadFile } from "../tools/files/read-file.js";
import { WriteFile } from "../tools/files/write-file.js";
import { BoardLister } from "../tools/list-tools.js";
import { type BBRTTool } from "../tools/tool-types.js";
import { connectedEffect } from "../util/connected-effect.js";
import "./artifact-display.js";
import "./chat.js";
import "./driver-selector.js";
import "./prompt.js";
import "./resizer.js";
import "./session-picker.js";
import "./tool-palette.js";

@customElement("bbrt-main")
export class BBRTMain extends SignalWatcher(LitElement) {
  @property({ type: Object })
  accessor config: Config | undefined = undefined;

  @property({ attribute: false })
  accessor #appState: ReactiveAppState | undefined = undefined;

  readonly #secrets: SecretsProvider;
  readonly #sessions: SessionStore;
  readonly #drivers: Map<string, BBRTDriver>;
  readonly #toolsPromise: Promise<Map<string, BBRTTool>>;
  readonly #persistence: Persistence = new LocalStoragePersistence();

  // TODO(aomarks) Due to the bug https://github.com/lit/lit/issues/4675, when
  // using standard decorators, context provider initialization must be done in
  // the constructor.
  @provide({ context: artifactStoreContext })
  accessor #artifacts: ArtifactStore;

  readonly #leftBar = createRef();
  readonly #rightBar = createRef();

  static override styles = css`
    :host {
      display: grid;
      --bbrt-resizer-thickness: 0;
      grid-template-areas:
        "sidebar resizeleft chatlog resizeright artifacts"
        "sidebar resizeleft chatlog resizeright artifacts"
        "sidebar resizeleft  inputs resizeright artifacts";
      grid-template-columns:
        var(--bbrt-left-bar-width, 300px) var(--bbrt-resizer-thickness) 1fr var(
          --bbrt-resizer-thickness
        )
        var(--bbrt-right-bar-width, 1fr);
      grid-template-rows: 1fr min-content;
    }
    #left-sidebar {
      grid-area: sidebar;
      border-right: 1px solid #ccc;
      display: flex;
      flex-direction: column;
    }
    bbrt-session-picker {
      overflow-y: auto;
      flex: 1;
      border-bottom: 1px solid #ccc;
    }
    bbrt-tool-palette {
      overflow-y: auto;
      flex: 1;
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
      align-items: flex-start;
    }
    bbrt-driver-selector {
      margin-top: 8px;
    }
    bbrt-prompt {
      flex-grow: 1;
    }
    bbrt-artifact-display {
      grid-area: artifacts;
      border-left: 1px solid #ccc;
      overflow: hidden;
    }
    #resizeLeft {
      grid-area: resizeleft;
    }
    #resizeRight {
      grid-area: resizeright;
    }
  `;

  constructor() {
    super();
    this.#artifacts = new ArtifactStore(new IdbArtifactReaderWriter());
    this.#secrets = new IndexedDBSettingsSecrets();
    this.#drivers = new Map<string, BBRTDriver>(
      [
        new GeminiDriver(() => this.#secrets.getSecret("GEMINI_API_KEY")),
        new OpenAiDriver(() => this.#secrets.getSecret("OPENAI_API_KEY")),
      ].map((driver) => [driver.id, driver])
    );

    const breadboardToolsPromise = this.#loadBreadboardTools();
    const standardTools: BBRTTool[] = [
      // Tool info
      new BoardLister(breadboardToolsPromise),
      new ActivateTool(
        breadboardToolsPromise.then(
          (tools) => new Set(tools.map((tool) => tool.metadata.id))
        ),
        () => this.#sessionState
      ),

      // Files
      new ReadFile(this.#artifacts),
      new WriteFile(this.#artifacts),
      new DisplayFile((path) => {
        if (!this.#sessionState) {
          return { ok: false, error: "No active session" };
        }
        this.#sessionState.activeArtifactId = path;
        return { ok: true, value: undefined };
      }),

      // BGL
      new CreateBoard(this.#artifacts),
      new AddNode(this.#artifacts),
    ];
    this.#toolsPromise = breadboardToolsPromise.then(
      (breadboardTools) =>
        new Map(
          [...standardTools, ...breadboardTools].map((tool) => [
            tool.metadata.id,
            tool,
          ])
        )
    );

    const sessionStore = new SessionStore({
      defaults: {
        systemPrompt: BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION,
        driverId: this.#drivers.keys().next().value!,
        activeToolIds: standardTools.map((tool) => tool.metadata.id),
      },
      persistence: this.#persistence,
    });
    this.#sessions = sessionStore;

    void (async () => {
      const appState = await this.#persistence.loadApp();
      if (!appState.ok) {
        // TODO(aomarks) Show error.
        console.error("Failed to load app state", appState.error);
        return;
      }
      if (appState.value) {
        this.#appState = appState.value;
      } else {
        this.#appState = new ReactiveAppState({
          activeSessionId: null,
          sessions: {},
        });
        const initialSessionBrief = this.#appState.createSessionBrief();
        const initialSession =
          await sessionStore.createSession(initialSessionBrief);
        if (!initialSession.ok) {
          // TODO(aomarks) Show error.
          console.error("Failed to create session", initialSession.error);
          return;
        }
        this.#appState.activeSessionId = initialSessionBrief.id;
      }

      // TODO(aomarks) Debounce
      connectedEffect(this, () => {
        if (this.#appState) {
          this.#persistence.saveApp(this.#appState);
        }
      });
      // TODO(aomarks) Debounce
      connectedEffect(this, () => {
        if (this.#sessionState) {
          this.#persistence.saveSession(this.#sessionState);
        }
      });
    })();
  }

  get #sessionState() {
    return this.#sessionStateComputed.value;
  }
  readonly #sessionStateComputed = new AsyncComputed<
    ReactiveSessionState | undefined
  >(async () => {
    if (!this.#appState) {
      return undefined;
    }
    const brief = this.#appState.activeSession;
    if (!brief) {
      return undefined;
    }
    const session = await this.#sessions.loadSession(brief);
    if (!session.ok || !session.value) {
      return undefined;
    }
    return session.value;
  });

  get #conversation() {
    return this.#conversationComputed.value;
  }
  readonly #conversationComputed = new AsyncComputed<Conversation | undefined>(
    async () => {
      const sessionState = await this.#sessionStateComputed.complete;
      if (!sessionState) {
        return undefined;
      }
      return new Conversation({
        state: sessionState,
        drivers: this.#drivers,
        availableToolsPromise: this.#toolsPromise,
      });
    }
  );

  override render() {
    const artifactId = this.#sessionState?.activeArtifactId;
    const artifact = artifactId ? this.#artifacts.entry(artifactId) : undefined;
    return html`
      <div id="inputs">
        <bbrt-driver-selector
          .conversation=${this.#conversation}
        ></bbrt-driver-selector>
        <bbrt-prompt .conversation=${this.#conversation}></bbrt-prompt>
      </div>

      <bbrt-chat
        .conversation=${this.#conversation}
        .appState=${this.#appState}
        .sessionStore=${this.#sessions}
        @bbrt-fork=${this.#onFork}
      ></bbrt-chat>

      <div id="left-sidebar" ${ref(this.#leftBar)}>
        <bbrt-session-picker
          .appState=${this.#appState}
          .sessionStore=${this.#sessions}
        ></bbrt-session-picker>
        <bbrt-tool-palette
          .conversation=${this.#conversation}
        ></bbrt-tool-palette>
      </div>

      <bbrt-resizer
        id="resizeLeft"
        .target=${this.#leftBar.value}
        .cssProperty=${"--bbrt-left-bar-width"}
        .cssPropertyReceiver=${this}
      ></bbrt-resizer>

      <bbrt-artifact-display
        ${ref(this.#rightBar)}
        .artifact=${artifact}
      ></bbrt-artifact-display>

      <bbrt-resizer
        id="resizeRight"
        .target=${this.#rightBar.value}
        .cssProperty=${"--bbrt-right-bar-width"}
        .cssPropertyReceiver=${this}
        reverse
      ></bbrt-resizer>
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

  #onFork(forkEvent: ForkEvent) {
    if (!this.#sessionState || !this.#appState) {
      return;
    }
    const sessionEvents = this.#sessionState.events;
    let sessionEventIndex = -1;
    // TODO(aomarks) Unnecessary O(n). Messages should instead know their event
    // index and include it when they dispatch a ForkEvent.
    for (let i = 0; i < sessionEvents.length; i++) {
      const sessionEvent = sessionEvents[i]!;
      if (
        sessionEvent.detail.kind === "turn" &&
        sessionEvent.detail.turn === forkEvent.turn
      ) {
        sessionEventIndex = i;
        break;
      }
    }
    if (sessionEventIndex === -1) {
      return;
    }
    const forkEvents = sessionEvents.slice(0, sessionEventIndex + 1);
    const appState = this.#appState;
    const forkBrief = appState.createSessionBrief(
      `Fork of ${this.#sessionState.title}`
    );
    this.#sessions.createSession(forkBrief, forkEvents).then((result) => {
      if (result.ok) {
        appState.activeSessionId = forkBrief.id;
      } else {
        // TODO(aomarks) Show an error.
        console.error(`Failed to fork session: ${result.error}`);
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-main": BBRTMain;
  }
}
