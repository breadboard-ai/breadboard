/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { run } from "@google-labs/breadboard/harness";
import { createRunConfig } from "./config";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { customElement, property, state } from "lit/decorators.js";
import {
  LitElement,
  html,
  css,
  HTMLTemplateResult,
  nothing,
  PropertyValueMap,
} from "lit";
import * as BreadboardUI from "@google-labs/breadboard-ui";
import { InputResolveRequest } from "@google-labs/breadboard/remote";
import { Board } from "@google-labs/breadboard";
import { cache } from "lit/directives/cache.js";

export const getBoardInfo = async (url: string) => {
  const runner = await Board.load(url);

  const { title, description, version } = runner;
  const diagram = runner.mermaid("TD", true);
  const nodes = runner.nodes;

  return { title, description, version, diagram, url, nodes };
};

const enum MODE {
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
  mode = MODE.BUILD;

  @state()
  toasts: Array<{ message: string; type: BreadboardUI.Events.ToastType }> = [];

  #uiRef: Ref<BreadboardUI.Elements.UI> = createRef();
  #previewRef: Ref<HTMLIFrameElement> = createRef();
  #boardId = 0;
  #delay = 0;
  #status = BreadboardUI.Types.STATUS.STOPPED;
  #statusObservers: Array<(value: BreadboardUI.Types.STATUS) => void> = [];
  #bootWithUrl: string | null = null;

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
      padding: calc(var(--bb-grid-size) * 6) calc(var(--bb-grid-size) * 8)
        calc(var(--bb-grid-size) * 0) calc(var(--bb-grid-size) * 8);
      font-size: var(--bb-text-default);
      grid-column: 1 / 3;
    }

    :host > header a {
      text-decoration: none;
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

    #header-bar a {
      font-size: 0;
      display: block;
      width: 16px;
      height: 16px;
      background: var(--bb-icon-arrow-back-white) center center no-repeat;
      margin: 0 calc(var(--bb-grid-size) * 5);
    }

    #header-bar h1 {
      font-size: var(--bb-text-default);
      font-weight: normal;
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
  `;

  constructor(config: { boards: BreadboardUI.Types.Board[] }) {
    super();

    // Remove boards that are still works-in-progress from production builds.
    // These boards will have either no version or a version of "0.0.1".
    if (import.meta.env.MODE === "production") {
      config.boards = config.boards.filter(
        (board) => board.version && board.version !== "0.0.1"
      );
    }

    config.boards.sort((a, b) => a.title.localeCompare(b.title));
    this.config = config;

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    const modeFromUrl = currentUrl.searchParams.get("mode");
    if (boardFromUrl) {
      this.#bootWithUrl = boardFromUrl;
    }

    if (modeFromUrl) {
      switch (modeFromUrl) {
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
    this.status = BreadboardUI.Types.STATUS.RUNNING;
  }

  protected async updated(changedProperties: Map<PropertyKey, unknown>) {
    if (!changedProperties.has("mode") && !changedProperties.has("url")) {
      return;
    }

    if (changedProperties.has("mode")) {
      this.#setActiveMode(this.mode);
    }

    if (this.mode === MODE.BUILD) {
      await this.#startHarnessIfNeeded();
    }
  }

  async #startHarnessIfNeeded() {
    // No URL, no UI, or an already-running board means we should stop.
    if (!this.url || !this.#uiRef.value || this.loadInfo) {
      return;
    }

    const ui = this.#uiRef.value;
    ui.url = this.url;
    this.loadInfo = await getBoardInfo(this.url);
    ui.load(this.loadInfo);

    const currentBoardId = this.#boardId;

    let lastEventTime = globalThis.performance.now();
    for await (const result of run(createRunConfig(this.url))) {
      // TODO(https://github.com/breadboard-ai/breadboard/issues/366)
      const runDuration = globalThis.performance.now() - lastEventTime;
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

  #setActiveMode(mode: string | null) {
    const pageUrl = new URL(window.location.href);
    if (mode === null) {
      pageUrl.searchParams.delete("mode");
    } else {
      pageUrl.searchParams.set("mode", mode);
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
    this.#setActiveBreadboard(null);

    this.#boardId++;
    if (!this.#uiRef.value) {
      console.warn("Unable to find UI");
      return;
    }
    this.#uiRef.value.unloadCurrentBoard();
  }

  render() {
    const toasts = html`${this.toasts.map(({ message, type }) => {
      return html`<bb-toast .message=${message} .type=${type}></bb-toast>`;
    })}`;

    let tmpl: HTMLTemplateResult | symbol = nothing;
    if (this.url) {
      let content: HTMLTemplateResult | symbol = nothing;
      switch (this.mode) {
        case MODE.BUILD: {
          content = html`<bb-ui-controller
            ${ref(this.#uiRef)}
            .url=${this.url}
            .loadInfo=${this.loadInfo}
            .status=${this.status}
            .bootWithUrl=${this.#bootWithUrl}
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

                this.#previewRef.value.src = "/preview.html";
              }}
            >
              Reload
            </button>
            <iframe
              ${ref(this.#previewRef)}
              src="/preview.html"
              credentialless
              reffererpolicy="no-referrer"
              sandbox="allow-forms allow-scripts"
            ></iframe>`;
          break;
        }

        default: {
          return html`Unknown mode`;
        }
      }

      tmpl = html`<div id="header-bar">
          <a href="/" @click=${this.#unloadCurrentBoard}>Back to list</a>
          <h1>${this.loadInfo?.title || "Loading board"}</h1>
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
    } else {
      tmpl = html`<header>
          <a href="/"><h1 id="title">Breadboard Playground</h1></a>
        </header>
        <bb-board-list
          @breadboardstart=${this.#onStartBoard}
          .boards=${this.config.boards}
          .bootWithUrl=${this.#bootWithUrl}
        ></bb-board-list>`;
    }

    return html`${tmpl} ${toasts}`;
  }
}
