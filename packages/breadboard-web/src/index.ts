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
import { Board, GraphDescriptor } from "@google-labs/breadboard";
import { cache } from "lit/directives/cache.js";

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
  #visualizer: "mermaid" | "visualblocks" | "editor" = "mermaid";

  static styles = css`
    :host {
      flex: 1 0 auto;
      display: grid;
      grid-template-rows: calc(var(--bb-grid-size) * 11) auto;
      grid-template-columns: calc(var(--bb-grid-size) * 16) auto;

      --rhs-top: 10fr;
      --rhs-mid: 45fr;
      --rhs-bottom: 45fr;
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
      background: rgb(113, 106, 162);
      display: flex;
      align-items: center;
      color: rgb(255, 255, 255);
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
      grid-column: 1 / 3;
      z-index: 1;
    }

    bb-board-list {
      grid-column: 1 / 3;
    }

    #header-bar a#back {
      font-size: 0;
      display: block;
      width: 16px;
      height: 16px;
      background: var(--bb-icon-arrow-back-white) center center no-repeat;
      margin: 0 calc(var(--bb-grid-size) * 5);
    }

    #download {
      font-size: var(--bb-text-pico);
      padding: 4px 8px 4px 24px;
      border-radius: 32px;
      background: #fff var(--bb-icon-download) 4px 2px no-repeat;
      background-size: 16px 16px;
      color: #333;
      margin-right: 8px;
      cursor: default;
      transition: opacity var(--bb-easing-duration-out) var(--bb-easing);
      opacity: 0.8;
      text-decoration: none;
    }

    #download:hover {
      transition: opacity var(--bb-easing-duration-in) var(--bb-easing);
      opacity: 1;
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

    #side-bar {
      background: rgb(255, 255, 255);
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
      align-items: center;
      display: flex;
      flex-direction: column;
      padding: calc(var(--bb-grid-size) * 2);
    }

    #side-bar button {
      width: 100%;
      font-size: var(--bb-text-small);
      color: rgb(57, 57, 57);
      text-align: center;
      background: none;
      cursor: pointer;
      margin: calc(var(--bb-grid-size) * 2) 0;
      padding-top: 32px;
      border: none;
      opacity: 0.5;
      position: relative;
    }

    #side-bar button:hover,
    #side-bar button[active] {
      opacity: 1;
    }

    #side-bar button[active] {
      pointer-events: none;
    }

    #side-bar button::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 30px;
      border-radius: 14px;
      background-position: center center;
      background-repeat: no-repeat;
    }

    #side-bar #select-build::before {
      background-image: var(--bb-icon-board);
    }

    #side-bar #select-preview::before {
      background-image: var(--bb-icon-preview);
    }

    #side-bar button[active]::before {
      background-color: rgb(240, 231, 249);
    }

    #content {
      height: calc(100vh - var(--bb-grid-size) * 15);
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

    const visualizer = currentUrl.searchParams.get("visualizer");
    if (
      visualizer === "mermaid" ||
      visualizer === "visualblocks" ||
      visualizer === "editor"
    ) {
      this.#visualizer = visualizer;
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
    this.status = BreadboardUI.Types.STATUS.RUNNING;
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
      await this.#startHarnessIfNeeded();
    }
  }

  async #startHarnessIfNeeded() {
    if (!(this.url && this.#uiRef.value && this.loadInfo)) {
      return;
    }

    const ui = this.#uiRef.value;
    ui.url = this.url;
    ui.load(this.loadInfo);

    const currentBoardId = this.#boardId;
    let lastEventTime = globalThis.performance.now();
    for await (const result of run(createRunConfig(this.url))) {
      const runDuration = result.data.timestamp - lastEventTime;
      if (this.#delay !== 0) {
        await new Promise((r) => setTimeout(r, this.#delay));
      }

      if (currentBoardId !== this.#boardId) {
        return;
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

  #setActiveVisualizer(visualizer: string | null) {
    const pageUrl = new URL(window.location.href);
    if (visualizer === null) {
      pageUrl.searchParams.delete("visualizer");
    } else {
      pageUrl.searchParams.set("visualizer", visualizer);
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

    // TODO: Don't switch off the editor here. It works this way for now so that
    // we only use the editor for blank boards.
    if (this.#visualizer === "editor") {
      this.#visualizer = "mermaid";
      this.#setActiveVisualizer(this.#visualizer);
    }

    if (!this.#uiRef.value) {
      return;
    }
    this.#uiRef.value.unloadCurrentBoard();
  }

  #downloadLog(evt: Event) {
    if (!(evt.target instanceof HTMLAnchorElement && this.#uiRef.value)) {
      return;
    }

    if (evt.target.href) {
      URL.revokeObjectURL(evt.target.href);
    }

    const messages = this.#uiRef.value.messages;

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

  async #createBlankBoard() {
    this.loadInfo = await getBoardInfo("/graphs/blank.json");
    this.loadInfo.title = "New board";
    this.mode = MODE.BUILD;
    this.#visualizer = "editor";
    this.#setActiveVisualizer(this.#visualizer);
  }

  render() {
    if (this.mode === MODE.LIST) {
      return html`<header>
          <a href="/"><h1 id="title">Breadboard Playground</h1></a>
        </header>
        <bb-board-list
          @breadboardstart=${this.#onStartBoard}
          .boards=${this.config.boards}
        ></bb-board-list>`;
    }

    const toasts = html`${this.toasts.map(({ message, type }) => {
      return html`<bb-toast .message=${message} .type=${type}></bb-toast>`;
    })}`;

    let tmpl: HTMLTemplateResult | symbol = nothing;
    let content: HTMLTemplateResult | symbol = nothing;
    switch (this.mode) {
      case MODE.BUILD: {
        content = html`<bb-ui-controller
          ${ref(this.#uiRef)}
          .url=${this.url}
          .loadInfo=${this.loadInfo}
          .status=${this.status}
          .visualizer=${this.#visualizer}
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
        <a id="download" @click=${this.#downloadLog}>Download log</a>
      </div>
      <div id="side-bar">
        <button
          id="select-build"
          ?active=${this.mode === MODE.BUILD}
          @click=${() => (this.mode = MODE.BUILD)}
        >
          Build
        </button>
        <button
          id="select-preview"
          ?active=${this.mode === MODE.PREVIEW}
          @click=${() => (this.mode = MODE.PREVIEW)}
        >
          Preview
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
