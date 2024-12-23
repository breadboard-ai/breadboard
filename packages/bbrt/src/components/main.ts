/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { provide } from "@lit/context";
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
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
import { BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION } from "../llm/system-instruction.js";
import { IndexedDBSettingsSecrets } from "../secrets/indexed-db-secrets.js";
import type { SecretsProvider } from "../secrets/secrets-provider.js";
import { LocalStorageAppPersister } from "../state/app-persistence.js";
import { ReactiveAppState } from "../state/app.js";
import { LocalStorageSessionPersister } from "../state/session-persistence.js";
import { SessionStore } from "../state/session-store.js";
import type { ReactiveSessionState } from "../state/session.js";
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
import "./session-picker.js";
import "./tool-palette.js";

@customElement("bbrt-main")
export class BBRTMain extends SignalWatcher(LitElement) {
  @property({ type: Object })
  accessor config: Config | undefined = undefined;

  @property({ attribute: false })
  accessor #state: ReactiveAppState | undefined = undefined;

  readonly #secrets: SecretsProvider;
  readonly #sessions: SessionStore;
  readonly #drivers: Map<string, BBRTDriver>;
  readonly #toolsPromise: Promise<Map<string, BBRTTool>>;

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
    this.#secrets = new IndexedDBSettingsSecrets();
    this.#drivers = new Map<string, BBRTDriver>(
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
        () => this.#sessionState
      ),
      new CreateBoard(this.#artifacts),
      new AddNode(this.#artifacts),
      new DisplayArtifact((artifactId) => {
        if (!this.#sessionState) {
          return { ok: false, error: "No active session" };
        }
        this.#sessionState.activeArtifactId = artifactId;
        return { ok: true, value: undefined };
      }),
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

    const appPersistence = new LocalStorageAppPersister();
    const sessionPersistence = new LocalStorageSessionPersister();
    const sessionStore = new SessionStore({
      defaults: {
        systemPrompt: BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION,
        driverId: this.#drivers.keys().next().value!,
        activeToolIds: standardTools.map((tool) => tool.metadata.id),
      },
      persistence: sessionPersistence,
    });
    this.#sessions = sessionStore;

    void (async () => {
      const appState = await appPersistence.load();
      if (!appState.ok) {
        // TODO(aomarks) Show error.
        console.error("Failed to load app state", appState.error);
        return;
      }
      if (appState.value) {
        this.#state = appState.value;
      } else {
        this.#state = new ReactiveAppState({
          activeSessionId: null,
          sessions: {},
        });
        const initialSessionBrief = this.#state.createSessionBrief();
        const initialSession =
          await sessionStore.createSession(initialSessionBrief);
        if (!initialSession.ok) {
          // TODO(aomarks) Show error.
          console.error("Failed to create session", initialSession.error);
          return;
        }
        this.#state.activeSessionId = initialSessionBrief.id;
      }

      connectedEffect(this, () => {
        if (this.#state) {
          appPersistence.save(this.#state);
        }
      });
      connectedEffect(this, () => {
        if (this.#sessionState) {
          sessionPersistence.save(this.#sessionState);
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
    if (!this.#state) {
      return undefined;
    }
    const brief = this.#state.activeSession;
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

      <bbrt-chat .conversation=${this.#conversation}></bbrt-chat>

      <div id="left-sidebar">
        <bbrt-session-picker
          .appState=${this.#state}
          .sessionStore=${this.#sessions}
        ></bbrt-session-picker>
        <bbrt-tool-palette
          .conversation=${this.#conversation}
        ></bbrt-tool-palette>
      </div>

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
