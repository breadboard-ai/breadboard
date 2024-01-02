/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  AnyHistoryEvent,
  Board,
  GraphEndHistoryEvent,
  GraphStartHistoryEvent,
  HistoryEventType,
  InputArgs,
  NodeEndHistoryEvent,
  NodeStartHistoryEvent,
} from "./types.js";
import { InputEnterEvent, ToastType } from "./events.js";
import { LoadArgs } from "./load.js";
import { Diagram } from "./diagram.js";
import { Input } from "./input.js";
import { Output, OutputArgs } from "./output.js";
import { NodeStartResponse } from "@google-labs/breadboard/remote";
import { NodeEndResponse } from "@google-labs/breadboard/harness";

const enum MODE {
  BUILD = "build",
  PREVIEW = "preview",
}

const hasPath = (
  event: AnyHistoryEvent
): event is
  | GraphEndHistoryEvent
  | GraphStartHistoryEvent
  | NodeStartHistoryEvent
  | NodeEndHistoryEvent =>
  event.type === HistoryEventType.NODESTART ||
  event.type === HistoryEventType.NODEEND ||
  event.type === HistoryEventType.GRAPHSTART ||
  event.type === HistoryEventType.GRAPHEND;

const pathToId = (path: number[]) => `path-${path.join("-")}`;

type HistoryListEntry = {
  id: string;
  type: HistoryEventType;
  nodeId: string;
  summary: string;
  data: unknown;
  elapsedTime: number;
  children: HistoryListEntry[];
};

// TODO: Change to bb-ui after migration.
@customElement("bb-ui-manager")
export class UI extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property({ reflect: true })
  paused = false;

  @property()
  highlightedDiagramNode = "";

  @property({ reflect: true })
  url: string | null = "";

  @property()
  boards: Board[] = [];

  @state()
  toasts: Array<{ message: string; type: ToastType }> = [];

  @state()
  inputs: Input[] = [];

  @state()
  outputs: Output[] = [];

  @state()
  historyEntries: HistoryListEntry[] = [];

  @state()
  mode = MODE.BUILD;

  #subHistoryEntries: Map<string, HistoryListEntry[]> = new Map();
  #diagram = new Diagram();
  #lastHistoryEventTime = Number.NaN;

  static styles = css`
    :host {
      flex: 1 0 auto;
      display: grid;
      grid-template-rows: calc(var(--bb-grid-size) * 11) auto;
      grid-template-columns: calc(var(--bb-grid-size) * 16) auto;
    }

    * {
      box-sizing: border-box;
    }

    header {
      padding: calc(var(--bb-grid-size) * 6) calc(var(--bb-grid-size) * 8)
        calc(var(--bb-grid-size) * 0) calc(var(--bb-grid-size) * 8);
      font-size: var(--bb-text-default);
      grid-column: 1 / 3;
    }

    header a {
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
      display: grid;
      grid-template-columns: 1fr 1fr;
      height: calc(100vh - var(--bb-grid-size) * 15);
      margin: 8px;
      column-gap: 8px;
    }

    #diagram {
      width: 100%;
      height: 100%;
      overflow: auto;
      border: 1px solid rgb(227, 227, 227);
      border-radius: calc(var(--bb-grid-size) * 5);
      display: flex;
    }

    #graph-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      column-gap: 8px;
      row-gap: 8px;
      overflow: auto;
    }

    #inputs,
    #outputs,
    #history {
      border: 1px solid rgb(227, 227, 227);
      border-radius: calc(var(--bb-grid-size) * 5);
      overflow: auto;
      background: rgb(255, 255, 255);
    }

    #history {
      grid-column: 1 / 3;
    }

    #history:empty::before,
    #output:empty::before,
    #input:empty::before {
      font-size: var(--bb-text-small);
      padding: calc(var(--bb-grid-size) * 5);
      padding-left: calc(var(--bb-grid-size) * 3 - 1px);
    }

    #history:empty::before {
      content: "No nodes have run yet";
    }

    #output:empty::before {
      content: "No board outputs received yet";
    }

    #input:empty::before {
      content: "No active board inputs";
    }

    #inputs h1,
    #outputs h1,
    #history h1 {
      font-size: var(--bb-text-small);
      font-weight: normal;
      margin: 0;
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
      border-bottom: 1px solid rgb(227, 227, 227);
      position: sticky;
      top: 0;
      background: rgb(255, 255, 255);
    }

    #inputs-list,
    #outputs-list,
    #history-list {
      scrollbar-gutter: stable;
      overflow-y: auto;
    }

    #inputs-list,
    #outputs-list {
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
    }
  `;

  toast(message: string, type: ToastType) {
    this.toasts.push({ message, type });
    this.requestUpdate();
  }

  async renderDiagram(highlightedDiagramNode = "") {
    if (!this.loadInfo || !this.loadInfo.diagram) {
      return;
    }

    return this.#diagram.render(this.loadInfo.diagram, highlightedDiagramNode);
  }

  #unloadCurrentBoard(evt: Event) {
    evt.preventDefault();

    if (!confirm("Are you sure you want to change boards?")) {
      return;
    }

    this.url = null;
    this.loadInfo = null;
    this.historyEntries.length = 0;
    this.#subHistoryEntries.clear();
    this.toasts.length = 0;
    this.inputs.length = 0;
    this.outputs.length = 0;

    this.#diagram = new Diagram();
    this.#lastHistoryEventTime = Number.NaN;
  }

  #historyEntryToTemplate(entry: HistoryListEntry): HTMLTemplateResult {
    return html`<bb-history-entry
      id=${entry.id}
      .nodeId=${entry.nodeId}
      .data=${entry.data}
      .summary=${entry.summary}
      .type=${entry.type}
      .elapsedTime=${entry.elapsedTime}
      >${entry.children.map((child) =>
        this.#historyEntryToTemplate(child)
      )}</bb-history-entry
    >`;
  }

  #getContent() {
    if (!this.loadInfo) {
      return html`Loading board...`;
    }

    switch (this.mode) {
      case MODE.BUILD: {
        return html`<div id="diagram">
            ${this.loadInfo.diagram ? this.#diagram : "No board diagram"}
          </div>
          <div id="graph-info">
            <div id="inputs">
              <h1>Inputs</h1>
              <div id="inputs-list">
                ${this.inputs.map((input) => {
                  return html`${input}`;
                })}
              </div>
            </div>
            <div id="outputs">
              <h1>Outputs</h1>
              <div id="outputs-list">
                ${this.outputs.map((output) => {
                  return html`${output}`;
                })}
              </div>
            </div>
            <div id="history">
              <h1>History</h1>
              <div id="history-list">
                ${this.historyEntries.map((entry) =>
                  this.#historyEntryToTemplate(entry)
                )}
              </div>
            </div>
          </div>`;
      }

      case MODE.PREVIEW: {
        return html`Coming soon...`;
      }

      default: {
        return html`Unknown mode`;
      }
    }
  }

  #createHistoryEntry(event: AnyHistoryEvent) {
    const { type, summary = "", id = "", data } = event;
    if (Number.isNaN(this.#lastHistoryEventTime)) {
      this.#lastHistoryEventTime = globalThis.performance.now();
    }

    const createId = () => {
      return hasPath(event) ? pathToId(event.data.path) : id || "";
    };

    const elapsedTime =
      globalThis.performance.now() - this.#lastHistoryEventTime;
    this.#lastHistoryEventTime = globalThis.performance.now();

    const findParent = () => {
      if (hasPath(event)) {
        let path = event.data.path;
        do {
          path = path.slice(0, -1);
          const parent = this.historyEntries.findIndex(
            (entry) => entry.id === pathToId(path)
          );
          if (parent !== -1) return parent;
        } while (path.length);
      }
      return 0;
    };

    const entry: HistoryListEntry = {
      type,
      nodeId: id,
      summary,
      data: hasPath(event) ? null : data,
      id: createId(),
      elapsedTime,
      children: [],
    };

    const parent = findParent();
    if (parent === 0) {
      this.historyEntries.unshift(entry);
    } else {
      this.historyEntries[parent].children.push(entry);
    }

    this.requestUpdate();
  }

  #updateHistoryEntry({ type, data }: NodeEndHistoryEvent) {
    const id = pathToId(data.path);

    let entryList = this.historyEntries;
    for (let idx = 0; idx < data.path.length - 1; idx++) {
      const id = pathToId(data.path.slice(0, idx + 1));
      const parentId = entryList.findIndex((item) => item.id === id);
      if (parentId === -1) {
        console.warn(`Unable to find ID "${id}"`);
        break;
      }

      entryList = this.historyEntries[parentId].children;
    }

    const historyEntry = entryList.find((item) => item.id === id);
    if (!historyEntry) {
      return;
    }

    historyEntry.type = type;
    historyEntry.data = data.outputs;
    this.requestUpdate();
  }

  async load(loadInfo: LoadArgs) {
    this.loadInfo = loadInfo;
    this.#lastHistoryEventTime = globalThis.performance.now();
    this.#createHistoryEntry({
      type: HistoryEventType.LOAD,
      summary: "Board loaded",
      data: { url: loadInfo.url || "" },
    });
  }

  async input(id: string, args: InputArgs): Promise<Record<string, unknown>> {
    const response: Record<string, unknown> = await new Promise((resolve) => {
      const input = new Input();
      input.id = id;
      input.args = args;

      input.addEventListener(InputEnterEvent.eventName, (evt: Event) => {
        const inputEvent = evt as InputEnterEvent;
        resolve(inputEvent.data);
      });

      this.inputs.unshift(input);
      this.requestUpdate();
    });

    this.#createHistoryEntry({
      type: HistoryEventType.INPUT,
      summary: "input",
      id,
      data: {
        args,
        response,
      },
    });

    return response;
  }

  async output(values: OutputArgs) {
    this.#createHistoryEntry({
      type: HistoryEventType.OUTPUT,
      summary: "Output",
      id: values.node.id,
      data: { outputs: values.outputs },
    });

    const output = new Output();
    await output.display(values.outputs);

    this.outputs.unshift(output);
    this.requestUpdate();
  }

  async secret(id: string): Promise<string> {
    const response: Record<string, string> = await new Promise((resolve) => {
      const input = new Input();
      input.id = id;
      input.args = {
        schema: {
          properties: {
            secret: {
              title: id,
              description: `Enter ${id}`,
              type: "string",
            },
          },
        },
      };
      input.remember = true;
      input.secret = true;

      this.inputs.push(input);
      this.requestUpdate();

      input.addEventListener(InputEnterEvent.eventName, (evt: Event) => {
        const inputEvent = evt as InputEnterEvent;
        resolve(inputEvent.data as Record<string, string>);

        this.inputs.splice(this.inputs.indexOf(input), 1);
        this.requestUpdate();
      });
    });

    this.#createHistoryEntry({
      type: HistoryEventType.SECRETS,
      summary: `secrets`,
      id,
    });

    return response.secret;
  }

  error(message: string) {
    this.#createHistoryEntry({
      type: HistoryEventType.ERROR,
      summary: message,
    });
  }

  done() {
    this.#createHistoryEntry({
      type: HistoryEventType.DONE,
      summary: "Board finished",
    });
  }

  nodestart(data: NodeStartResponse) {
    const {
      path,
      node: { id, type },
    } = data;
    this.#createHistoryEntry({
      type: HistoryEventType.NODESTART,
      summary: type,
      id,
      data: { path },
    });
  }

  nodeend(data: NodeEndResponse) {
    const {
      path,
      node: { id },
      outputs,
    } = data;
    this.#updateHistoryEntry({
      type: HistoryEventType.NODEEND,
      id,
      data: { path, outputs },
    });
  }

  render() {
    const toasts = html`${this.toasts.map(({ message, type }) => {
      return html`<bb-toast .message=${message} .type=${type}></bb-toast>`;
    })}`;

    let tmpl: HTMLTemplateResult | symbol = nothing;
    if (this.url) {
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
        <div id="content" class="${this.mode}">${this.#getContent()}</div>`;
    } else {
      tmpl = html`<header>
          <a href="/"><h1 id="title">Breadboard Playground</h1></a>
        </header>
        <bb-board-list .boards=${this.boards}></bb-board-list>`;
    }

    return html`${tmpl} ${toasts}`;
  }
}
