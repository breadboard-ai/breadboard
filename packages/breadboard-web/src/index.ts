/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { run } from "@google-labs/breadboard/harness";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { customElement, property, state } from "lit/decorators.js";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import { InputResolveRequest } from "@google-labs/breadboard/remote";
import {
  BoardRunner,
  createLoader,
  edit,
  EditableGraph,
  EditResult,
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  InspectableRun,
  InspectableRunObserver,
  Kit,
} from "@google-labs/breadboard";
import { cache } from "lit/directives/cache.js";
import { classMap } from "lit/directives/class-map.js";
import { createRunObserver } from "@google-labs/breadboard";
import { loadKits } from "./utils/kit-loader";
import GeminiKit from "@google-labs/gemini-kit";
import { FileSystemGraphProvider } from "./providers/file-system";
import BuildExampleKit from "./build-example-kit";
import { addNodeProxyServerConfig } from "./config";
import { SettingsStore } from "./data/settings-store";

type MainArguments = {
  boards: BreadboardUI.Types.Board[];
  providers?: GraphProvider[];
  settings?: SettingsStore;
};

// TODO: Remove once all elements are Lit-based.
BreadboardUI.register();

@customElement("bb-main")
export class Main extends LitElement {
  @property({ reflect: true })
  url: string | null = null;

  @state()
  graph: GraphDescriptor | null = null;

  @state()
  kits: Kit[] = [];

  @state()
  runs: InspectableRun[] | null = null;

  @state()
  embed = false;

  @state()
  showNav = false;

  @state()
  showPreviewOverlay = false;

  @state()
  showBoardEditOverlay = false;

  @state()
  showSettingsOverlay = false;

  @state()
  toasts: Array<{ message: string; type: BreadboardUI.Events.ToastType }> = [];

  @state()
  providerOps = 0;

  #uiRef: Ref<BreadboardUI.Elements.UI> = createRef();
  #boardId = 0;
  #boardPendingSave = false;
  #lastBoardId = 0;
  #delay = 0;
  #status = BreadboardUI.Types.STATUS.STOPPED;
  #runObserver: InspectableRunObserver | null = null;
  #editor: EditableGraph | null = null;
  #providers: GraphProvider[];
  #settings: SettingsStore | null;
  #loader: GraphLoader;
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #failedGraphLoad = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      flex: 1 0 auto;
      display: grid;
      grid-template-rows: calc(var(--bb-grid-size) * 12) auto;
    }

    bb-toast {
      z-index: 2000;
    }

    :host > header {
      display: grid;
      grid-template-columns: auto min-content;
      padding: calc(var(--bb-grid-size) * 6) calc(var(--bb-grid-size) * 8)
        calc(var(--bb-grid-size) * 0) calc(var(--bb-grid-size) * 8);
      font-size: var(--bb-text-default);
      grid-column: 1 / 3;
    }

    :host > header a {
      text-decoration: none;
      white-space: nowrap;
    }

    #show-nav {
      font-size: 0;
      width: 24px;
      height: 24px;
      background: var(--bb-icon-menu) center center no-repeat;
      border: none;
      margin-right: calc(var(--bb-grid-size) * 2);
      cursor: pointer;
    }

    #edit-board-info {
      font-size: 0;
      width: 20px;
      height: 20px;
      background: var(--bb-icon-edit) center center no-repeat;
      background-size: 20px 20px;
      border: none;
      margin-left: calc(var(--bb-grid-size) * 3);
      opacity: 0.6;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #edit-board-info:not([disabled]) {
      cursor: pointer;
    }

    #edit-board-info:not([disabled]):hover {
      transition-duration: 0.1s;
      opacity: 1;
    }

    #new-board {
      font-size: var(--bb-text-nano);
    }

    #header-bar {
      background: var(--bb-output-600);
      display: flex;
      align-items: center;
      color: var(--bb-neutral-50);
      border-bottom: 1px solid var(--bb-neutral-300);
      z-index: 1;
      height: calc(var(--bb-grid-size) * 12);
      padding: calc(var(--bb-grid-size) * 2);
    }

    #save-board,
    #get-log,
    #get-board,
    #toggle-preview,
    #toggle-settings {
      color: var(--bb-neutral-50);
      padding: 0 16px 0 42px;
      font-size: var(--bb-text-medium);
      margin: 0 calc(var(--bb-grid-size) * 3) 0 0;
      cursor: pointer;
      background: 12px center var(--bb-icon-download);
      background-repeat: no-repeat;
      height: 100%;
      display: flex;
      align-items: center;
      text-decoration: none;
      border-radius: 20px;
      border: none;
    }

    #save-board:hover,
    #get-log:hover,
    #get-board:hover,
    #toggle-preview:hover,
    #toggle-settings:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }

    #save-board {
      background: 12px center var(--bb-icon-save);
      background-repeat: no-repeat;
    }

    #toggle-preview {
      background: 12px center var(--bb-icon-preview);
      background-repeat: no-repeat;
    }

    #toggle-preview.active {
      background-color: var(--bb-output-800);
    }

    #toggle-settings {
      padding: 8px;
      font-size: 0;
      margin-right: 0;
      background: 4px center var(--bb-icon-settings);
      background-repeat: no-repeat;
      width: 32px;
    }

    #toggle-settings.active {
      background-color: var(--bb-output-800);
    }

    #new-board {
      font-size: var(--bb-text-small);
      text-decoration: underline;
    }

    #new-board:active {
      color: rgb(90, 64, 119);
    }

    #save-board[disabled],
    #get-log[disabled],
    #get-board[disabled],
    #toggle-preview[disabled],
    #save-board[disabled]:hover,
    #get-log[disabled]:hover,
    #get-board[disabled]:hover,
    #toggle-preview[disabled]:hover {
      opacity: 0.5;
      background-color: rgba(0, 0, 0, 0);
      pointer-events: none;
      cursor: auto;
    }

    bb-board-list {
      grid-column: 1 / 3;
    }

    #header-bar a#back {
      font-size: 0;
      display: block;
      width: 16px;
      height: 16px;
      background: var(--bb-icon-arrow-back) center center no-repeat;
      margin: 0 calc(var(--bb-grid-size) * 3);
    }

    #header-bar h1 {
      font-size: var(--bb-text-default);
      font-weight: normal;
      flex: 1;
      display: flex;
      align-items: center;
    }

    #title {
      font: var(--bb-text-baseline) var(--bb-font-family-header);
      color: rgb(90, 64, 119);
      margin: 0;
      display: inline;
    }

    #content {
      max-height: calc(100svh - var(--bb-grid-size) * 12);
      display: flex;
      flex-direction: column;
    }

    #reload {
      height: 32px;
      width: 100px;
      margin: calc(var(--bb-grid-size) * 2);
      align-self: flex-end;
      background: #fff var(--bb-icon-frame-reload) 9px 3px no-repeat;
      border-radius: calc(var(--bb-grid-size) * 4);
      border: 1px solid rgb(204, 204, 204);
      padding: 0 8px 0 32px;
    }

    iframe {
      grid-row: 1 / 3;
      grid-column: 1 / 3;
      margin: 0;
      border: none;
      width: 100%;
      height: 100%;
      display: block;
    }

    bb-overlay iframe {
      width: 80vw;
      height: 80vh;
      border-radius: 8px;
    }

    #embed {
      grid-column: 1/3;
      grid-row: 1/3;
    }

    #embed iframe {
      margin: 0;
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 0;
    }

    #embed header {
      display: flex;
      padding: 0 calc(var(--bb-grid-size) * 9);
      align-items: center;
    }
  `;

  constructor(config: MainArguments) {
    super();

    this.#providers = config.providers || [];
    this.#settings = config.settings || null;
    // Single loader instance for all boards.
    this.#loader = createLoader(this.#providers);

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    const embedFromUrl = currentUrl.searchParams.get("embed");
    this.embed = embedFromUrl !== null && embedFromUrl !== "false";

    Promise.all([
      loadKits([
        GeminiKit,
        // TODO(aomarks) This is presumably not the right way to do this. How do
        // I get something into this.#providers?
        BuildExampleKit,
      ]),
      ...this.#providers.map((provider) => provider.restore()),
      this.#settings?.restore(),
    ]).then(([kits]) => {
      this.kits = kits;

      this.#providers.map((provider) => {
        if (provider.extendedCapabilities().watch) {
          provider.watch((change) => {
            const currentUrl = new URL(window.location.href);
            const boardFromUrl = currentUrl.searchParams.get("board");
            if (boardFromUrl?.endsWith(change.filename)) {
              this.#onStartBoard(
                new BreadboardUI.Events.StartEvent(change.filename)
              );
            }
          });
        }
      });

      if (boardFromUrl) {
        this.#onStartBoard(new BreadboardUI.Events.StartEvent(boardFromUrl));
        return;
      }

      this.#startFromProviderDefault();
    });
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#checkForPossibleEmbed();
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  #startFromProviderDefault() {
    let startingURL;
    for (const provider of this.#providers) {
      startingURL = provider.startingURL();
      if (startingURL) {
        this.#onStartBoard(
          new BreadboardUI.Events.StartEvent(startingURL.href)
        );
        break;
      }
    }
  }

  #checkForPossibleEmbed() {
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;
    const hasTouch = window.matchMedia("(any-pointer: coarse)").matches;
    const currentUrl = new URL(window.location.href);
    const embedIsNotSet = currentUrl.searchParams.get("embed") === null;

    if (isPortrait && hasTouch && this.url && embedIsNotSet) {
      this.embed = true;
      this.#setUrlParam("embed", "true");

      return true;
    }

    return false;
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.key === "s" && evt.metaKey) {
      evt.preventDefault();
      this.#attemptBoardSave();
    }
  }

  async #attemptBoardSave() {
    if (!this.graph || !this.graph.url) {
      return;
    }
    const boardUrl = new URL(this.graph.url);
    const provider = this.#getProviderForURL(boardUrl);
    if (!provider) {
      this.toast("Unable to save board", BreadboardUI.Events.ToastType.ERROR);
      return;
    }

    const capabilities = provider.canProvide(boardUrl);
    if (!capabilities || !capabilities.save) {
      return;
    }
    const { result } = await provider.save(boardUrl, this.graph);
    if (!result) {
      return;
    }

    this.#boardPendingSave = false;
    this.toast("Board saved", BreadboardUI.Events.ToastType.INFORMATION);
  }

  get status() {
    return this.#status;
  }

  set status(status: BreadboardUI.Types.STATUS) {
    this.#status = status;
    this.requestUpdate();
  }

  async #onStartBoard(startEvent: BreadboardUI.Events.StartEvent) {
    this.#boardId++;
    this.#setUrlParam("board", startEvent.url);
    this.url = startEvent.url;
    if (startEvent.descriptor) {
      this.graph = startEvent.descriptor;
      // TODO: Figure out how to avoid needing to null this out.
      this.#editor = null;
    }
    this.status = BreadboardUI.Types.STATUS.STOPPED;
    this.#runObserver = null;
    this.#boardPendingSave = false;

    this.#checkForPossibleEmbed();
  }

  protected async updated() {
    if (!this.url && !this.graph) {
      return;
    }

    // Board has already started; don't restart.
    if (this.#lastBoardId === this.#boardId) {
      return;
    }

    this.#failedGraphLoad = false;
    this.#lastBoardId = this.#boardId;
    if (this.url) {
      try {
        const base = new URL(window.location.href);
        const graph = await this.#loader.load(this.url, { base });
        if (!graph) {
          throw new Error(`Unable to load graph: ${this.url}`);
        }
        this.graph = graph;
        // TODO: Figure out how to avoid needing to null this out.
        this.#editor = null;
      } catch (err) {
        this.url = null;
        this.graph = null;
        // TODO: Figure out how to avoid needing to null this out.

        this.#editor = null;
        this.#failedGraphLoad = true;
      }
    } else if (this.graph) {
      if (!this.graph.url) {
        this.graph.url = window.location.href;
      }
    } else {
      return;
    }
  }

  #getEditor() {
    if (!this.graph) return null;
    if (this.#editor) return this.#editor;

    this.#editor = edit(this.graph, { kits: this.kits, loader: this.#loader });
    this.#editor.addEventListener("graphchange", (evt) => {
      this.graph = evt.graph;
      this.#boardPendingSave = true;
    });
    return this.#editor;
  }

  // TODO: Allow this to run boards directly.
  async #runBoard(runner: ReturnType<typeof run>) {
    if (!(this.#uiRef.value && this.graph)) {
      return;
    }

    const ui = this.#uiRef.value;
    ui.graph = this.graph;
    ui.clearPosition();

    const currentBoardId = this.#boardId;

    this.status = BreadboardUI.Types.STATUS.RUNNING;
    if (!this.#runObserver)
      this.#runObserver = createRunObserver({
        logLevel: "debug",
      });
    for await (const result of runner) {
      // Update "runs" to ensure the UI is aware when the new run begins.
      this.runs = this.#runObserver.observe(result);
      if (this.#delay !== 0) {
        await new Promise((r) => setTimeout(r, this.#delay));
      }

      if (currentBoardId !== this.#boardId) {
        return;
      }

      const answer = await ui.handleStateChange(result);
      if (answer) {
        await result.reply({ inputs: answer } as InputResolveRequest);
      }
    }
    this.status = BreadboardUI.Types.STATUS.STOPPED;
  }

  #setUrlParam(param: string, value: string | null) {
    const pageUrl = new URL(window.location.href);
    if (value === null) {
      pageUrl.searchParams.delete(param);
    } else {
      pageUrl.searchParams.set(param, value);
    }
    window.history.replaceState(null, "", pageUrl);
  }

  toast(message: string, type: BreadboardUI.Events.ToastType) {
    this.toasts.push({ message, type });
    this.requestUpdate();
  }

  #getBoardJson(evt: Event) {
    if (!(evt.target instanceof HTMLAnchorElement) || !this.graph) {
      return;
    }

    if (evt.target.href) {
      URL.revokeObjectURL(evt.target.href);
    }

    // Remove the URL from the descriptor as its not part of BGL's schema.
    const board = structuredClone(this.graph);
    delete board["url"];

    const data = JSON.stringify(board, null, 2);
    evt.target.download = `board-${new Date().toISOString()}.json`;
    evt.target.href = URL.createObjectURL(
      new Blob([data], { type: "application/json" })
    );
  }

  #getProviderByName(name: string) {
    return this.#providers.find((provider) => provider.name === name) || null;
  }

  #getProviderForURL(url: URL) {
    return this.#providers.find((provider) => provider.canProvide(url));
  }

  async #confirmSaveWithUserFirstIfNeeded() {
    if (!this.#boardPendingSave) {
      return;
    }

    if (!this.graph || !this.graph.url) {
      return;
    }

    try {
      const url = new URL(this.graph.url, window.location.href);
      const provider = this.#getProviderForURL(url);
      if (!provider) {
        return;
      }

      const capabilities = provider.canProvide(url);
      if (!capabilities || !capabilities.save) {
        return;
      }
    } catch (err) {
      // Likely an error with the URL.
      return;
    }

    if (
      !confirm("The current board isn't saved - would you like to save first?")
    ) {
      return;
    }

    return this.#attemptBoardSave();
  }

  render() {
    const toasts = html`${this.toasts.map(({ message, type }, idx, toasts) => {
      const offset = toasts.length - idx - 1;
      return html`<bb-toast
        .offset=${offset}
        .message=${message}
        .type=${type}
      ></bb-toast>`;
    })}`;

    let tmpl: HTMLTemplateResult | symbol = nothing;
    const currentRun = this.#runObserver?.runs()[0];
    let saveButton: HTMLTemplateResult | symbol = nothing;
    if (this.graph && this.graph.url) {
      try {
        const url = new URL(this.graph.url);
        const provider = this.#getProviderForURL(url);
        const capabilities = provider?.canProvide(url);
        if (provider && capabilities && capabilities.save) {
          saveButton = html`<button
            id="save-board"
            title="Save Board BGL"
            @click=${this.#attemptBoardSave}
          >
            Save
          </button>`;
        }
      } catch (err) {
        // If there are any problems with the URL, etc, don't offer the save button.
      }
    }

    const settings = this.#settings ? this.#settings.values : null;
    const title = this.graph?.title;
    const showingOverlay =
      this.showBoardEditOverlay ||
      this.showPreviewOverlay ||
      this.showSettingsOverlay;
    tmpl = html`<div id="header-bar" ?inert=${showingOverlay}>
        <button
          id="show-nav"
          @click=${() => {
            this.showNav = !this.showNav;
            document.body.addEventListener(
              "pointerdown",
              () => {
                this.showNav = false;
              },
              { once: true }
            );
          }}
        ></button>
        <h1>
          ${title}
          <button
            @click=${() => {
              this.showBoardEditOverlay = true;
            }}
            ?disabled=${this.graph === null}
            id="edit-board-info"
            title="Edit Board Information"
          >
            Edit
          </button>
        </h1>
        ${saveButton}
        <a
          id="get-board"
          title="Export Board BGL"
          ?disabled=${this.graph === null}
          @click=${this.#getBoardJson}
          >Export</a
        >
        <button
          class=${classMap({ active: this.showPreviewOverlay })}
          id="toggle-preview"
          title="Toggle Board Preview"
          ?disabled=${this.graph === null}
          @click=${() => {
            this.showPreviewOverlay = !this.showPreviewOverlay;
          }}
        >
          Preview
        </button>
        <button
          class=${classMap({ active: this.showSettingsOverlay })}
          id="toggle-settings"
          title="Toggle Settings"
          @click=${() => {
            this.showSettingsOverlay = !this.showSettingsOverlay;
          }}
        >
          Settings
        </button>
      </div>
      <div id="content" ?inert=${showingOverlay}>
        ${cache(
          html`<bb-ui-controller
            ${ref(this.#uiRef)}
            .graph=${this.graph}
            .run=${currentRun}
            .kits=${this.kits}
            .loader=${this.#loader}
            .status=${this.status}
            .boardId=${this.#boardId}
            .failedToLoad=${this.#failedGraphLoad}
            .settings=${settings}
            @breadboardfiledrop=${async (
              evt: BreadboardUI.Events.FileDropEvent
            ) => {
              if (this.status === BreadboardUI.Types.STATUS.RUNNING) {
                this.toast(
                  "Unable to update; board is already running",
                  BreadboardUI.Events.ToastType.ERROR
                );
                return;
              }

              this.#onStartBoard(
                new BreadboardUI.Events.StartEvent(null, evt.descriptor)
              );
            }}
            @breadboardrunboard=${async () => {
              if (!this.graph?.url) {
                return;
              }

              const runner = await BoardRunner.fromGraphDescriptor(this.graph);

              this.#runBoard(
                run(
                  addNodeProxyServerConfig({
                    url: this.graph.url,
                    runner,
                    diagnostics: true,
                    kits: this.kits,
                    loader: this.#loader,
                  })
                )
              );
            }}
            @breadboardedgechange=${(
              evt: BreadboardUI.Events.EdgeChangeEvent
            ) => {
              const editableGraph = this.#getEditor();
              if (!editableGraph) {
                console.warn("Unable to create node; no active graph");
                return;
              }

              let editResult: Promise<EditResult>;
              switch (evt.changeType) {
                case "add": {
                  editResult = editableGraph.addEdge(evt.from);
                  break;
                }

                case "remove": {
                  editResult = editableGraph.removeEdge(evt.from);
                  break;
                }

                case "move": {
                  if (!evt.to) {
                    throw new Error("Unable to move edge - no `to` provided");
                  }

                  editResult = editableGraph.changeEdge(evt.from, evt.to);
                  break;
                }
              }

              editResult.then((result) => {
                if (!result.success) {
                  this.toast(result.error, BreadboardUI.Events.ToastType.ERROR);
                }
              });
            }}
            @breadboardnodemove=${(evt: BreadboardUI.Events.NodeMoveEvent) => {
              const editableGraph = this.#getEditor();
              if (!editableGraph) {
                console.warn("Unable to update node metadata; no active graph");
                return;
              }

              const inspectableGraph = editableGraph.inspect();

              const { id, x, y } = evt;
              const existingNode = inspectableGraph.nodeById(id);
              const metadata = existingNode?.metadata() || {};
              let visual = metadata.visual || {};
              if (typeof visual !== "object") {
                visual = {};
              }

              editableGraph
                .changeMetadata(id, {
                  ...metadata,
                  visual: { ...visual, x, y },
                })
                .then((result) => {
                  if (!result.success) {
                    this.toast(
                      result.error,
                      BreadboardUI.Events.ToastType.ERROR
                    );
                  }
                });
            }}
            @breadboardnodemultilayout=${(
              evt: BreadboardUI.Events.NodeMultiLayoutEvent
            ) => {
              const editableGraph = this.#getEditor();
              if (!editableGraph) {
                console.warn("Unable to update node metadata; no active graph");
                return;
              }

              const inspectableGraph = editableGraph.inspect();

              Promise.all(
                [...evt.layout.entries()].map(([id, { x, y }]) => {
                  const existingNode = inspectableGraph.nodeById(id);

                  const metadata = existingNode?.metadata() || {};
                  let visual = metadata?.visual || {};
                  if (typeof visual !== "object") {
                    visual = {};
                  }

                  return editableGraph.changeMetadata(id, {
                    ...metadata,
                    visual: { ...visual, x, y },
                  });
                })
              );
            }}
            @breadboardnodecreate=${(
              evt: BreadboardUI.Events.NodeCreateEvent
            ) => {
              const { id, nodeType } = evt;
              const newNode = {
                id,
                type: nodeType,
              };

              const editableGraph = this.#getEditor();
              if (!editableGraph) {
                console.warn("Unable to create node; no active graph");
                return;
              }

              editableGraph.addNode(newNode).then((result) => {
                if (!result.success) {
                  this.toast(
                    `Unable to create node: ${result.error}`,
                    BreadboardUI.Events.ToastType.ERROR
                  );
                }
              });
            }}
            @breadboardnodeupdate=${(
              evt: BreadboardUI.Events.NodeUpdateEvent
            ) => {
              const editableGraph = this.#getEditor();
              if (!editableGraph) {
                console.warn("Unable to create node; no active graph");
                return;
              }

              editableGraph
                .changeConfiguration(evt.id, evt.configuration)
                .then((result) => {
                  if (!result.success) {
                    this.toast(
                      "Unable to update configuration",
                      BreadboardUI.Events.ToastType.ERROR
                    );
                  }
                });
            }}
            @breadboardnodedelete=${(
              evt: BreadboardUI.Events.NodeDeleteEvent
            ) => {
              const editableGraph = this.#getEditor();
              if (!editableGraph) {
                console.warn("Unable to create node; no active graph");
                return;
              }

              editableGraph.removeNode(evt.id).then((result) => {
                if (!result.success) {
                  this.toast(
                    `Unable to remove node: ${result.error}`,
                    BreadboardUI.Events.ToastType.ERROR
                  );
                }
              });
            }}
            @breadboardmessagetraversal=${() => {
              if (this.status !== BreadboardUI.Types.STATUS.RUNNING) {
                return;
              }

              this.status = BreadboardUI.Types.STATUS.PAUSED;
              this.toast(
                "Board paused",
                "information" as BreadboardUI.Events.ToastType
              );
            }}
            @breadboardtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
              if (!this.#uiRef.value) {
                return;
              }

              this.toast(toastEvent.message, toastEvent.toastType);
            }}
            @breadboarddelay=${(delayEvent: BreadboardUI.Events.DelayEvent) => {
              this.#delay = delayEvent.duration;
            }}
            @breadboardinputenter=${async (
              event: BreadboardUI.Events.InputEnterEvent
            ) => {
              if (!this.#settings) {
                return;
              }

              const isSecret = "secret" in event.data;
              const shouldSaveSecrets =
                this.#settings
                  .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
                  .items.get("Save Secrets")?.value || false;
              if (!shouldSaveSecrets || !isSecret) {
                return;
              }

              const name = event.id;
              const value = event.data.secret as string;
              const settingsItems = this.#settings.getSection(
                BreadboardUI.Types.SETTINGS_TYPE.SECRETS
              ).items;
              if (settingsItems.has(event.id)) {
                const settingsItem = settingsItems.get(event.id);
                if (settingsItem) {
                  settingsItem.value = value;
                }
              } else {
                settingsItems.set(name, { name, value });
              }

              await this.#settings.save(this.#settings.values);
            }}
          ></bb-ui-controller>`
        )}
      </div>
      <bb-nav
        .providers=${this.#providers}
        .visible=${this.showNav}
        .url=${this.url}
        .providerOps=${this.providerOps}
        ?inert=${showingOverlay}
        @pointerdown=${(evt: Event) => evt.stopImmediatePropagation()}
        @graphproviderblankboard=${async (
          evt: BreadboardUI.Events.GraphProviderBlankBoardEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!provider) {
            this.toast(
              "Unable to find provider",
              BreadboardUI.Events.ToastType.ERROR
            );
            return;
          }
          const url = new URL(provider.createURL(evt.location, evt.fileName));
          const { result, error } = await provider.createBlank(url);

          if (!result) {
            this.toast(
              error || "Unable to create blank board",
              BreadboardUI.Events.ToastType.ERROR
            );
            return;
          }

          // Trigger a re-render.
          this.providerOps++;
        }}
        @graphproviderdeleterequest=${async (
          evt: BreadboardUI.Events.GraphProviderDeleteRequestEvent
        ) => {
          if (
            !confirm(
              "Are you sure you want to delete this board? This cannot be undone"
            )
          ) {
            return;
          }

          const provider = this.#getProviderByName(evt.providerName);
          if (!provider) {
            this.toast(
              "Unable to delete file",
              BreadboardUI.Events.ToastType.ERROR
            );
            return;
          }

          const { result, error } = await provider.delete(new URL(evt.url));
          if (!result) {
            this.toast(
              error || "Unexpected error",
              BreadboardUI.Events.ToastType.ERROR
            );
          }

          if (evt.isActive) {
            this.#startFromProviderDefault();
          }

          // Trigger a re-render.
          this.providerOps++;
        }}
        @breadboardstart=${(evt: BreadboardUI.Events.StartEvent) => {
          if (this.status !== BreadboardUI.Types.STATUS.STOPPED) {
            if (
              !confirm(
                "A board is currently running. Do you want to load this file?"
              )
            ) {
              return;
            }
          }

          this.#onStartBoard(evt);
        }}
        @graphproviderrefresh=${async (
          evt: BreadboardUI.Events.GraphProviderRefreshEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!provider) {
            return;
          }

          const refreshed = await provider.refresh(evt.location);
          if (refreshed) {
            this.toast(
              "Source files refreshed",
              BreadboardUI.Events.ToastType.INFORMATION
            );
          } else {
            this.toast(
              "Unable to refresh source files",
              BreadboardUI.Events.ToastType.WARNING
            );
          }

          // Trigger a re-render.
          this.providerOps++;
        }}
        @graphproviderdisconnect=${async (
          evt: BreadboardUI.Events.GraphProviderDisconnectEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!provider) {
            return;
          }

          await provider.disconnect(evt.location);

          // Trigger a re-render.
          this.providerOps++;
        }}
        @graphproviderrenewaccesssrequest=${async (
          evt: BreadboardUI.Events.GraphProviderRenewAccessRequestEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!(provider instanceof FileSystemGraphProvider)) {
            return;
          }

          await provider.renewAccessRequest(evt.location);

          // Trigger a re-render.
          this.providerOps++;
        }}
        @graphproviderloadrequest=${async (
          evt: BreadboardUI.Events.GraphProviderLoadRequestEvent
        ) => {
          await this.#confirmSaveWithUserFirstIfNeeded();

          if (this.status !== BreadboardUI.Types.STATUS.STOPPED) {
            if (
              !confirm(
                "A board is currently running. Do you want to load this file?"
              )
            ) {
              return;
            }
          }

          try {
            this.#onStartBoard(new BreadboardUI.Events.StartEvent(evt.url));
          } catch (err) {
            this.toast(
              `Unable to load file: ${evt.url}`,
              BreadboardUI.Events.ToastType.ERROR
            );
          }
        }}
        @graphproviderconnectrequest=${async (
          evt: BreadboardUI.Events.GraphProviderConnectRequestEvent
        ) => {
          const provider = this.#getProviderByName(evt.providerName);
          if (!(provider instanceof FileSystemGraphProvider)) {
            return;
          }

          const success = await provider.connect();
          if (!success) {
            return;
          }

          // Trigger a re-render.
          this.providerOps++;
        }}
      ></bb-nav> `;

    if (this.embed) {
      tmpl = html`<iframe
        src="/preview.html?board=${this.url}&embed=true"
      ></iframe>`;
    }

    let boardOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showBoardEditOverlay && this.graph) {
      boardOverlay = html`<bb-board-edit-overlay
        .boardTitle=${title}
        .boardVersion=${this.graph?.version}
        .boardDescription=${this.graph?.description}
        @breadboardboardoverlaydismissed=${() => {
          this.showBoardEditOverlay = false;
        }}
        @breadboardboardinfoupdate=${(
          evt: BreadboardUI.Events.BoardInfoUpdateEvent
        ) => {
          if (!this.graph) {
            return;
          }

          if (this.graph) {
            this.graph.title = evt.title;
            this.graph.version = evt.version;
            this.graph.description = evt.description;
          }

          this.toast(
            "Board information updated",
            BreadboardUI.Events.ToastType.INFORMATION
          );

          this.showBoardEditOverlay = false;
          this.requestUpdate();
        }}
      ></bb-board-edit-overlay>`;
    }

    let previewOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showPreviewOverlay) {
      previewOverlay = html`<bb-overlay
        class="board-preview"
        @breadboardboardoverlaydismissed=${() => {
          this.showPreviewOverlay = false;
        }}
        ><iframe src="/preview.html?board=${this.url}"></iframe
      ></bb-overlay>`;
    }

    let settingsOverlay: HTMLTemplateResult | symbol = nothing;
    if (this.showSettingsOverlay) {
      settingsOverlay = html`<bb-settings-edit-overlay
        class="settings"
        .settings=${this.#settings?.values || null}
        @breadboardboardsettingsupdate=${async (
          evt: BreadboardUI.Events.SettingsUpdateEvent
        ) => {
          if (!this.#settings) {
            return;
          }

          try {
            await this.#settings.save(evt.settings);
            this.toast(
              "Saved settings",
              BreadboardUI.Events.ToastType.INFORMATION
            );
          } catch (err) {
            this.toast(
              "Unable to save settings",
              BreadboardUI.Events.ToastType.ERROR
            );
          }

          this.requestUpdate();
        }}
        @breadboardboardoverlaydismissed=${() => {
          this.showSettingsOverlay = false;
        }}
      ></bb-settings-edit-overlay>`;
    }

    return html`${tmpl} ${boardOverlay} ${previewOverlay} ${settingsOverlay}
    ${toasts} `;
  }
}
