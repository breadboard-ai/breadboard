/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { run } from "@google-labs/breadboard/harness";
import { createRunConfig } from "./config";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { customElement, property, state } from "lit/decorators.js";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import { InputResolveRequest } from "@google-labs/breadboard/remote";
import {
  Board,
  BoardRunner,
  edit,
  EditResult,
  GraphDescriptor,
  InspectableRun,
  InspectableRunObserver,
  Kit,
} from "@google-labs/breadboard";
import { cache } from "lit/directives/cache.js";
import { classMap } from "lit/directives/class-map.js";
import { createRunObserver } from "@google-labs/breadboard";

export const getBoardInfo = async (
  url: string
): Promise<BreadboardUI.Types.LoadArgs> => {
  const runner = await Board.load(url, { base: new URL(window.location.href) });

  const { title, description, version } = runner;
  const diagram = runner.mermaid("TD", true, true);
  const nodes = runner.nodes;
  const graphDescriptor: GraphDescriptor = runner;

  return { title, description, version, diagram, url, graphDescriptor, nodes };
};

const enum MODE {
  LIST = "list",
  BUILD = "build",
  PREVIEW = "preview",
}

// TODO: Remove once all elements are Lit-based.
BreadboardUI.register();

@customElement("bb-main")
export class Main extends LitElement {
  @property({ reflect: false })
  config: { boards: BreadboardUI.Types.Board[] };

  @property({ reflect: true })
  url: string | null = null;

  @property({ reflect: false })
  loadInfo: BreadboardUI.Types.LoadArgs | null = null;

  @state()
  kits: Kit[] = [];

  @state()
  runs: InspectableRun[] | null = null;

  @state()
  mode = MODE.LIST;

  @state()
  embed = false;

  @state()
  toasts: Array<{ message: string; type: BreadboardUI.Events.ToastType }> = [];

  #uiRef: Ref<BreadboardUI.Elements.UI> = createRef();
  #previewRef: Ref<HTMLIFrameElement> = createRef();
  #boardId = 0;
  #lastBoardId = 0;
  #delay = 0;
  #status = BreadboardUI.Types.STATUS.STOPPED;
  #statusObservers: Array<(value: BreadboardUI.Types.STATUS) => void> = [];
  #runObserver: InspectableRunObserver = createRunObserver();

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
      z-index: 100;
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

    #new-board {
      font-size: var(--bb-text-nano);
    }

    #header-bar {
      background: #f3f3f6;
      display: flex;
      align-items: center;
      color: #1a1a1a;
      border-bottom: 1px solid #d9d9d9;
      z-index: 1;
      height: calc(var(--bb-grid-size) * 12);
      padding: calc(var(--bb-grid-size) * 2);
    }

    #get-log,
    #get-board,
    #toggle-preview {
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

    #get-log:hover,
    #get-board:hover,
    #toggle-preview:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    #toggle-preview {
      margin-right: 0;
      background: 12px center var(--bb-icon-preview);
      background-repeat: no-repeat;
    }

    #toggle-preview.active {
      background-color: #ffffff;
    }

    #new-board {
      font-size: var(--bb-text-small);
      text-decoration: underline;
    }

    #new-board:active {
      color: rgb(90, 64, 119);
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
    }

    #title {
      font: var(--bb-text-baseline) var(--bb-font-family-header);
      color: rgb(90, 64, 119);
      margin: 0;
      display: inline;
    }

    #content {
      height: calc(100vh - var(--bb-grid-size) * 12);
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
      flex: 1 0 auto;
      margin: 0 calc(var(--bb-grid-size) * 2);
      border-radius: calc(var(--bb-grid-size) * 5);
      border: 1px solid rgb(227, 227, 227);
    }

    #embed {
      display: grid;
      grid-template-rows: calc(var(--bb-grid-size) * 10) auto;
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

  constructor(config: { boards: BreadboardUI.Types.Board[] }) {
    super();

    // Remove boards that are still works-in-progress from production builds.
    // These boards will have no version.
    if (import.meta.env.MODE === "production") {
      config.boards = config.boards.filter((board) => board.version);
    }

    config.boards.sort((a, b) => a.title.localeCompare(b.title));
    this.config = config;

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    const modeFromUrl = currentUrl.searchParams.get("mode");
    this.embed = currentUrl.searchParams.get("embed") !== null;
    if (boardFromUrl) {
      this.#onStartBoard(new BreadboardUI.Events.StartEvent(boardFromUrl));
    } else if (modeFromUrl === MODE.BUILD) {
      this.#createBlankBoard();
    }

    if (modeFromUrl) {
      switch (modeFromUrl) {
        case "list":
          this.mode = MODE.LIST;
          break;

        case "build":
          this.mode = MODE.BUILD;
          break;

        case "preview":
          this.mode = MODE.PREVIEW;
          break;
      }
    }
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
    this.#setActiveBreadboard(startEvent.url);
    this.url = startEvent.url;
    this.mode = MODE.BUILD;
  }

  protected async updated(changedProperties: Map<PropertyKey, unknown>) {
    if (!changedProperties.has("mode")) {
      return;
    }

    if (changedProperties.has("mode")) {
      this.#setActiveMode(this.mode);
    }

    if (!this.url) {
      return;
    }

    // Board has already started; don't restart.
    if (this.#lastBoardId === this.#boardId) {
      return;
    }

    this.#lastBoardId = this.#boardId;
    this.loadInfo = await getBoardInfo(this.url);

    if (this.mode === MODE.BUILD) {
      await this.#createHarnessAndRunFromUrl();
    }
  }

  async #createHarnessAndRunFromUrl() {
    if (!(this.url && this.loadInfo)) {
      return;
    }

    const runConfig = await createRunConfig(this.url);

    this.kits = runConfig.kits;

    const runner = run(runConfig);
    await this.#runBoard(runner);
  }

  // TODO: Allow this to run boards directly.
  async #runBoard(runner: ReturnType<typeof run>) {
    if (!(this.#uiRef.value && this.loadInfo)) {
      return;
    }

    const ui = this.#uiRef.value;
    ui.load(this.loadInfo);

    ui.clearPosition();

    const currentBoardId = this.#boardId;

    this.status = BreadboardUI.Types.STATUS.RUNNING;
    let lastEventTime = globalThis.performance.now();
    for await (const result of runner) {
      // Update "runs" to ensure the UI is aware when the new run begins.
      this.runs = this.#runObserver?.observe(result);
      const runDuration = result.data.timestamp - lastEventTime;
      if (this.#delay !== 0) {
        await new Promise((r) => setTimeout(r, this.#delay));
      }

      if (currentBoardId !== this.#boardId) {
        return;
      }

      if (result.type === "skip") {
        console.log("Skipping", result);
      }

      const answer = await ui.handleStateChange(result, runDuration);
      await this.#waitIfPaused(answer);

      // We reset the time here because we don't want to include the user input
      // round trip in the "board time".
      lastEventTime = globalThis.performance.now();
      if (answer) {
        await result.reply({ inputs: answer } as InputResolveRequest);
      }
    }
    this.status = BreadboardUI.Types.STATUS.STOPPED;
  }

  #waitIfPaused(answer: unknown) {
    // We can use the answer as a signal for whether or not to proceed. In cases
    // where user input is not required, the answer will be void/undefined, and
    // we should honor the pause signal. When a user submits an answer (which
    // they can only do for the most recent message going to the UI) then its
    // value will not be void/undefined, and we can treat that as a signal to
    // unpause.
    const shouldUnpause = typeof answer !== "undefined";
    if (shouldUnpause && this.status === BreadboardUI.Types.STATUS.PAUSED) {
      if (confirm("Are you sure you wish to resume?")) {
        this.status = BreadboardUI.Types.STATUS.RUNNING;
      }
    }

    if (this.status !== BreadboardUI.Types.STATUS.PAUSED) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.#statusObservers.push((status: BreadboardUI.Types.STATUS) => {
        if (status !== BreadboardUI.Types.STATUS.RUNNING) {
          return;
        }

        resolve();
      });
    });
  }

  #setActiveBreadboard(url: string | null) {
    const pageUrl = new URL(window.location.href);
    if (url === null) {
      pageUrl.searchParams.delete("board");
    } else {
      pageUrl.searchParams.set("board", url);
    }
    window.history.replaceState(null, "", pageUrl);
  }

  #setActiveMode(mode: string | null) {
    const pageUrl = new URL(window.location.href);
    if (mode === null) {
      pageUrl.searchParams.delete("mode");
    } else {
      pageUrl.searchParams.set("mode", mode);
    }
    window.history.replaceState(null, "", pageUrl);
  }

  #setEmbed(embed: boolean | null) {
    const pageUrl = new URL(window.location.href);
    if (embed === null || embed === false) {
      pageUrl.searchParams.delete("embed");
    } else {
      pageUrl.searchParams.set("embed", `${embed}`);
    }
    window.history.replaceState(null, "", pageUrl);
  }

  toast(message: string, type: BreadboardUI.Events.ToastType) {
    this.toasts.push({ message, type });
    this.requestUpdate();
  }

  #unloadCurrentBoard(evt: Event) {
    evt.preventDefault();

    if (!confirm("Are you sure you want to change boards?")) {
      return;
    }

    this.url = null;
    this.loadInfo = null;
    this.mode = MODE.LIST;
    this.#setActiveBreadboard(null);

    if (!this.#uiRef.value) {
      return;
    }
    this.#uiRef.value.unloadCurrentBoard();
  }

  #getRunLog(evt: Event) {
    if (!(evt.target instanceof HTMLAnchorElement && this.#uiRef.value)) {
      return;
    }

    if (evt.target.href) {
      URL.revokeObjectURL(evt.target.href);
    }

    const messages = this.#runObserver?.runs()[0].messages || [];

    const secrets = [];
    const inputs = [];
    const outputs = [];
    const errors = [];
    for (const message of messages) {
      if (message.type === "error") {
        errors.push(message);
      }

      if (message.type === "output") {
        outputs.push(message);
      }

      if (message.type === "nodeend") {
        switch (message.data.node.type) {
          case "secrets": {
            secrets.push(...Object.values(message.data.outputs));
            break;
          }

          case "input": {
            inputs.push(message);
            break;
          }

          case "output": {
            outputs.push(message);
            break;
          }
        }
      }
    }

    let data = JSON.stringify(
      { board: this.loadInfo, inputs, outputs, errors, history: messages },
      null,
      2
    );

    // Attempt to find any secrets and then replace them in the JSON output.
    for (const secret of secrets) {
      const re = new RegExp(`\\b${secret}\\b`, "gim");
      data = data.replaceAll(re, "SECRET");
    }

    evt.target.download = `${new Date().toISOString()}.json`;
    evt.target.href = URL.createObjectURL(
      new Blob([data], { type: "application/json" })
    );
  }

  #getBoardJson(evt: Event) {
    if (
      !(evt.target instanceof HTMLAnchorElement) ||
      !this.loadInfo ||
      !this.loadInfo.graphDescriptor
    ) {
      return;
    }

    if (evt.target.href) {
      URL.revokeObjectURL(evt.target.href);
    }

    // Remove the URL from the descriptor as its not part of BGL's schema.
    const board = structuredClone(this.loadInfo.graphDescriptor);
    delete board["url"];

    const data = JSON.stringify(board, null, 2);
    evt.target.download = `board-${new Date().toISOString()}.json`;
    evt.target.href = URL.createObjectURL(
      new Blob([data], { type: "application/json" })
    );
  }

  async #createBlankBoard() {
    this.loadInfo = await getBoardInfo("/graphs/blank.json");
    this.loadInfo.title = "New board";
    this.mode = MODE.BUILD;

    if (this.loadInfo.url) {
      const config = await createRunConfig(this.loadInfo.url);
      this.kits = config.kits;
    }
  }

  #updateLoadInfo(graphDescriptor: GraphDescriptor) {
    this.loadInfo = {
      ...this.loadInfo,
      graphDescriptor,
    };
  }

  render() {
    const toasts = html`${this.toasts.map(({ message, type }) => {
      return html`<bb-toast .message=${message} .type=${type}></bb-toast>`;
    })}`;

    if (this.mode === MODE.LIST) {
      return html`<header>
          <a href="/"><h1 id="title">Breadboard Playground</h1></a>
          <a id="new-board" href="/?mode=build">Create new board</a>
        </header>
        <bb-board-list
          @breadboardstart=${this.#onStartBoard}
          @breadboardtoast=${(toastEvent: BreadboardUI.Events.ToastEvent) => {
            this.toast(toastEvent.message, toastEvent.toastType);
          }}
          .boards=${this.config.boards}
        ></bb-board-list>
        ${toasts}`;
    }

    let tmpl: HTMLTemplateResult | symbol = nothing;
    let content: HTMLTemplateResult | symbol = nothing;
    const currentRun = this.#runObserver.runs()[0];
    switch (this.mode) {
      case MODE.BUILD: {
        content = html`<bb-ui-controller
          ${ref(this.#uiRef)}
          .url=${this.url}
          .loadInfo=${this.loadInfo}
          .run=${currentRun}
          .kits=${this.kits}
          .status=${this.status}
          @breadboardrunboard=${async () => {
            if (
              !this.loadInfo?.graphDescriptor ||
              !this.loadInfo.graphDescriptor.url
            ) {
              return;
            }

            const runner = await BoardRunner.fromGraphDescriptor(
              this.loadInfo.graphDescriptor
            );

            const runConfig = await createRunConfig(
              this.loadInfo.graphDescriptor.url
            );
            runConfig.runner = runner;
            this.kits = runConfig.kits;

            this.#runBoard(run(runConfig));
          }}
          @breadboardedgechange=${(
            evt: BreadboardUI.Events.EdgeChangeEvent
          ) => {
            if (!this.loadInfo) {
              console.warn("Unable to create node; no active graph");
              return;
            }

            const loadInfo = this.loadInfo;
            if (!loadInfo.graphDescriptor) {
              console.warn("Unable to create node; no graph descriptor");
              return;
            }

            const editableGraph = edit(loadInfo.graphDescriptor, {
              kits: this.kits,
            });

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

              this.#updateLoadInfo(editableGraph.raw());
            });
          }}
          @breadboardnodemove=${(evt: BreadboardUI.Events.NodeMoveEvent) => {
            if (!this.loadInfo) {
              console.warn("Unable to update node metadata; no active graph");
              return;
            }

            const loadInfo = this.loadInfo;
            if (!loadInfo.graphDescriptor) {
              console.warn(
                "Unable to update node metadata; no graph descriptor"
              );
              return;
            }

            const editableGraph = edit(loadInfo.graphDescriptor, {
              kits: this.kits,
            });

            const { id, x, y } = evt;
            editableGraph
              .changeMetadata(id, { visual: { x, y } })
              .then((result) => {
                if (!result.success) {
                  this.toast(result.error, BreadboardUI.Events.ToastType.ERROR);
                }

                this.#updateLoadInfo(editableGraph.raw());
              });
          }}
          @breadboardnodecreate=${(
            evt: BreadboardUI.Events.NodeCreateEvent
          ) => {
            const { id, nodeType } = evt;
            const newNode = {
              id,
              type: nodeType,
            };

            if (!this.loadInfo) {
              console.warn("Unable to create node; no active graph");
              return;
            }

            const loadInfo = this.loadInfo;
            if (!loadInfo.graphDescriptor) {
              console.warn("Unable to create node; no graph descriptor");
              return;
            }

            const editableGraph = edit(loadInfo.graphDescriptor, {
              kits: this.kits,
            });
            editableGraph.addNode(newNode).then((result) => {
              if (!result.success) {
                this.toast(
                  `Unable to create node: ${result.error}`,
                  BreadboardUI.Events.ToastType.ERROR
                );
              }

              this.#updateLoadInfo(editableGraph.raw());
            });
          }}
          @breadboardnodeupdate=${(
            evt: BreadboardUI.Events.NodeUpdateEvent
          ) => {
            if (!this.loadInfo) {
              console.warn("Unable to create node; no active graph");
              return;
            }

            const loadInfo = this.loadInfo;
            if (!loadInfo.graphDescriptor) {
              console.warn("Unable to create node; no graph descriptor");
              return;
            }

            const editableGraph = edit(loadInfo.graphDescriptor, {
              kits: this.kits,
            });

            editableGraph
              .changeConfiguration(evt.id, evt.configuration)
              .then((result) => {
                if (!result.success) {
                  this.toast(
                    "Unable to update configuration",
                    BreadboardUI.Events.ToastType.ERROR
                  );
                }

                this.#updateLoadInfo(editableGraph.raw());
              });
          }}
          @breadboardnodedelete=${(
            evt: BreadboardUI.Events.NodeDeleteEvent
          ) => {
            if (!this.loadInfo) {
              console.warn("Unable to create node; no active graph");
              return;
            }

            const loadInfo = this.loadInfo;
            if (!loadInfo.graphDescriptor) {
              console.warn("Unable to create node; no graph descriptor");
              return;
            }

            const editableGraph = edit(loadInfo.graphDescriptor, {
              kits: this.kits,
            });
            editableGraph.removeNode(evt.id).then((result) => {
              if (!result.success) {
                this.toast(
                  `Unable to remove node: ${result.error}`,
                  BreadboardUI.Events.ToastType.ERROR
                );
              }

              this.#updateLoadInfo(editableGraph.raw());
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
          .boards=${this.config.boards}
        ></bb-ui-controller>`;
        break;
      }

      case MODE.PREVIEW: {
        // TODO: Do this with Service Workers.
        content = html`<button
            id="reload"
            @click=${() => {
              if (!this.#previewRef.value) {
                return;
              }

              this.#previewRef.value.src = `/preview.html?board=${this.url}`;
            }}
          >
            Reload
          </button>
          <iframe
            ${ref(this.#previewRef)}
            src="/preview.html?board=${this.url}"
          ></iframe>`;
        break;
      }

      default: {
        return html`Unknown mode`;
      }
    }

    tmpl = html`<div id="header-bar">
        <a id="back" href="/" @click=${this.#unloadCurrentBoard}
          >Back to list</a
        >
        <h1>${this.loadInfo?.title || "Untitled board"}</h1>
        <a id="get-board" @click=${this.#getBoardJson}>Get code</a>
        <a id="get-log" @click=${this.#getRunLog}>Get log</a>
        <button
          class=${classMap({ active: this.mode === MODE.PREVIEW })}
          id="toggle-preview"
          @click=${() => {
            this.mode = this.mode === MODE.BUILD ? MODE.PREVIEW : MODE.BUILD;
          }}
        >
          Toggle Preview
        </button>
      </div>
      <div id="content" class="${this.mode}">${cache(content)}</div>`;

    if (this.embed) {
      tmpl = html`<main id="embed">
        <header>
          <button
            @click=${() => {
              this.#setEmbed(null);
              this.embed = false;
            }}
          >
            View in Debugger
          </button>
        </header>
        <iframe src="/preview.html?board=${this.url}&embed=true"></iframe>
      </main>`;
    }

    return html`${tmpl} ${toasts}`;
  }
}
