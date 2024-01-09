/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Board, HistoryEventType, HistoryEntry, InputArgs } from "./types.js";
import {
  BoardUnloadEvent,
  InputEnterEvent,
  NodeSelectEvent,
  ToastType,
} from "./events.js";
import { LoadArgs } from "./load.js";
import { Diagram } from "./diagram.js";
import { Input } from "./input.js";
import { Output, OutputArgs } from "./output.js";
import {
  AnyRunResult,
  EndResult,
  ErrorResult,
  NodeEndResult,
  NodeStartResult,
} from "@google-labs/breadboard/harness";
import {
  NodeConfiguration,
  NodeDescriptor,
  ProbeMessage,
  TraversalResult,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";

const enum MODE {
  BUILD = "build",
  PREVIEW = "preview",
}

const hasPath = (
  event: AnyRunResult
): event is ProbeMessage | NodeStartResult | NodeEndResult =>
  event.type === "nodestart" ||
  event.type === "nodeend" ||
  event.type === "graphstart" ||
  event.type === "graphend";

const hasState = (event: AnyRunResult): event is NodeStartResult =>
  event.type === "nodestart";

const pathToId = (path: number[]) => {
  if (path.length == 0) {
    return `path-main-graph`;
  }

  return `path-${path.join("-")}`;
};

type ExtendedNodeInformation = {
  id: string;
  type: string;
  configuration: NodeConfiguration | undefined;
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
  historyEntries: HistoryEntry[] = [];

  @state()
  mode = MODE.BUILD;

  @state()
  selectedNode: ExtendedNodeInformation | null = null;

  #subHistoryEntries: Map<string, HistoryEntry[]> = new Map();
  #diagram = new Diagram();
  #lastHistoryEventTime = Number.NaN;
  #nodeInfo: Map<string, ExtendedNodeInformation> = new Map();
  #gridInfoRef: Ref<HTMLElement> = createRef();
  #gridInfoBB: DOMRect | null = null;

  static styles = css`
    :host {
      flex: 1 0 auto;
      display: grid;
      grid-template-rows: calc(var(--bb-grid-size) * 11) auto;
      grid-template-columns: calc(var(--bb-grid-size) * 16) auto;

      --row-top: 1fr;
      --row-bottom: 1fr;
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
      column-gap: 8px;
      height: calc(100vh - var(--bb-grid-size) * 15);
      margin: 8px;
    }

    @media (orientation: portrait) {
      #content {
        grid-template-columns: initial;
        grid-template-rows: 0.4fr 0.6fr;
        row-gap: 8px;
      }
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
      grid-template-rows: var(--row-top) 8px var(--row-bottom);
      column-gap: 8px;
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

    #inputs,
    #outputs {
      display: flex;
      flex-direction: column;
    }

    #history {
      display: grid;
      grid-column: 1 / 3;
    }

    #drag-handle {
      cursor: ns-resize;
      grid-column: 1 / 3;
    }

    #inputs h1,
    #outputs h1,
    #history h1 {
      font-size: var(--bb-text-small);
      font-weight: bold;
      margin: 0;
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
      border-bottom: 1px solid rgb(227, 227, 227);
      position: sticky;
      top: 0;
      background: rgb(255, 255, 255);
      z-index: 1;
    }

    #inputs-list,
    #outputs-list,
    #history-list {
      scrollbar-gutter: stable;
      overflow-y: auto;
      font-size: var(--bb-text-small);
    }

    #inputs-list,
    #outputs-list {
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
    }

    bb-output {
      border-bottom: 1px solid #aaa;
    }

    bb-output:last-of-type {
      border-bottom: none;
    }

    #node-information {
      display: flex;
      flex-direction: column;
      position: absolute;
      bottom: 20px;
      left: 20px;
      max-width: calc(var(--bb-grid-size) * 90);
      max-height: 40%;
      border-radius: calc(var(--bb-grid-size) * 6);
      background: rgb(255, 255, 255);
      padding: calc(var(--bb-grid-size) * 4);
      border: 1px solid rgb(204, 204, 204);
      box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.13),
        0 7px 9px 0 rgba(0, 0, 0, 0.16);
      overflow-y: auto;
      scrollbar-gutter: stable;
    }

    #node-information h1 {
      font-size: var(--bb-text-medium);
      margin: 0;
      font-weight: 400;
      padding: 0 0 0 calc(var(--bb-grid-size) * 8);
      line-height: calc(var(--bb-grid-size) * 6);
      cursor: pointer;
      background: var(--bb-icon-info) 0 0 no-repeat;
    }

    #node-information dl {
      margin: calc(var(--bb-grid-size) * 2) 0;
      padding-right: calc(var(--bb-grid-size) * 5);
      display: grid;
      grid-template-columns: fit-content(50px) 1fr;
      column-gap: calc(var(--bb-grid-size) * 2);
      row-gap: calc(var(--bb-grid-size) * 1);
      font-size: var(--bb-text-nano);
      width: 100%;
      flex: 1;
      overflow: auto;
      scrollbar-gutter: stable;
    }

    #node-information dd {
      margin: 0;
      font-weight: bold;
    }

    #node-information pre {
      font-size: var(--bb-text-nano);
      white-space: pre-wrap;
      margin: 0;
    }

    #node-information #close {
      position: absolute;
      right: calc(var(--bb-grid-size) * 3);
      top: calc(var(--bb-grid-size) * 4);
      width: 24px;
      height: 24px;
      background: var(--bb-icon-close) center center no-repeat;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    #node-information #close:hover {
      opacity: 1;
    }
  `;

  constructor() {
    super();

    this.#diagram.addEventListener(NodeSelectEvent.eventName, (evt: Event) => {
      const nodeSelect = evt as NodeSelectEvent;
      this.selectedNode = this.#nodeInfo.get(nodeSelect.id) || null;
    });
  }

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

    this.#nodeInfo.clear();

    this.#diagram.reset();
    this.#lastHistoryEventTime = Number.NaN;

    this.dispatchEvent(new BoardUnloadEvent());
  }

  #getContent() {
    if (!this.loadInfo) {
      return html`Loading board...`;
    }

    switch (this.mode) {
      case MODE.BUILD: {
        return html`<div id="diagram">
            ${this.loadInfo.diagram ? this.#diagram : "No board diagram"}
            ${this.selectedNode
              ? html`<div id="node-information">
                  <h1>Node Information</h1>
                  <button id="close" @click=${() => (this.selectedNode = null)}>
                    Close
                  </button>
                  <dl>
                    <dd>ID</dd>
                    <dt>${this.selectedNode.id}</dt>
                    <dd>Type</dd>
                    <dt>${this.selectedNode.type}</dt>
                    <dd>Configuration</dd>
                    <dt>
                      <bb-json-tree
                        .json=${this.selectedNode.configuration}
                        autoExpand="true"
                      ></bb-json-tree>
                    </dt>
                  </dl>
                </div>`
              : nothing}
          </div>
          <div id="graph-info" ${ref(this.#gridInfoRef)}>
            <div id="inputs">
              <h1>Inputs</h1>
              <div id="inputs-list">
                ${this.inputs.length
                  ? this.inputs.map((input) => {
                      return html`${input}`;
                    })
                  : html`There are no inputs yet.`}
              </div>
            </div>
            <div id="outputs">
              <h1>Outputs</h1>
              <div id="outputs-list">
                ${this.outputs.length
                  ? this.outputs.map((output) => {
                      return html`${output}`;
                    })
                  : html`There are no outputs yet.`}
              </div>
            </div>
            <div
              id="drag-handle"
              @pointerdown=${this.#startVerticalResize}
              @pointermove=${this.#onVerticalResize}
              @pointerup=${this.#endVerticalResize}
            ></div>
            <div id="history">
              <bb-history-tree
                .history=${this.historyEntries}
                .lastUpdate=${this.#lastHistoryEventTime}
              ></bb-history-tree>
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

  firstUpdated() {
    const rowTop = globalThis.sessionStorage.getItem("grid-row-top");
    const rowBottom = globalThis.sessionStorage.getItem("grid-row-bottom");
    if (!(rowTop && rowBottom)) {
      return;
    }

    this.#applyGridRowHeight(rowTop, rowBottom);
  }

  #applyGridRowHeight(rowTop: string, rowBottom: string) {
    this.style.setProperty("--row-top", rowTop);
    this.style.setProperty("--row-bottom", rowBottom);
  }

  #startVerticalResize(evt: PointerEvent) {
    if (!(evt.target instanceof HTMLElement)) {
      return;
    }

    if (!this.#gridInfoRef.value) {
      return;
    }

    evt.target.setPointerCapture(evt.pointerId);
    this.#gridInfoBB = this.#gridInfoRef.value.getBoundingClientRect();
  }

  #onVerticalResize(evt: PointerEvent) {
    if (this.#gridInfoBB === null) {
      return;
    }

    let normalizedY =
      (evt.pageY - this.#gridInfoBB.top) / this.#gridInfoBB.height;

    if (normalizedY < 0.1) {
      normalizedY = 0.1;
    } else if (normalizedY > 0.9) {
      normalizedY = 0.9;
    }

    this.#applyGridRowHeight(`${normalizedY}fr`, `${1 - normalizedY}fr`);
  }

  #endVerticalResize() {
    if (!this.#gridInfoBB) {
      return;
    }

    this.#gridInfoBB = null;

    const rowTop = this.style.getPropertyValue("--row-top");
    const rowBottom = this.style.getPropertyValue("--row-bottom");

    globalThis.sessionStorage.setItem("grid-row-top", rowTop);
    globalThis.sessionStorage.setItem("grid-row-bottom", rowBottom);
  }

  #createHistoryEntry(event: AnyRunResult) {
    if (Number.isNaN(this.#lastHistoryEventTime)) {
      this.#lastHistoryEventTime = globalThis.performance.now();
    }

    const getNodeData = (): HistoryEntry["graphNodeData"] => {
      if (hasPath(event)) {
        if (hasState(event) && typeof event.data.state === "object") {
          const id = hasPath(event) ? pathToId(event.data.path) : "";
          const nodeValues = event.data.state.state.state.get(id);
          if (!nodeValues) {
            return null;
          }

          const nodeValue: Record<string, unknown[]> = {};
          for (const [key, value] of nodeValues.entries()) {
            nodeValue[key] = value;
          }

          return { inputs: nodeValue, outputs: {} };
        }

        return undefined;
      }

      return { inputs: event.data, outputs: {} };
    };

    const elapsedTime =
      globalThis.performance.now() - this.#lastHistoryEventTime;
    this.#lastHistoryEventTime = globalThis.performance.now();

    const entry: HistoryEntry = {
      ...event,
      graphNodeData: getNodeData(),
      id: hasPath(event) ? pathToId(event.data.path) : "",
      guid: globalThis.crypto.randomUUID(),
      elapsedTime,
      children: [],
    };

    if (hasPath(event)) {
      const entryList = this.#findParentHistoryEntry(event.data.path);
      if (event.type === HistoryEventType.GRAPHSTART) {
        // If this is a graph start and there is a corresponding nodestart with
        // the same path we will adjust the positions so that the graphstart
        // appears just before the nodestart. This tends to match the mental
        // model a bit closer, where we think of a board starting before the
        // nodes it contains.
        const existingNodeStartEntryIdx = entryList.findIndex(
          (sibling) => sibling.id === pathToId(event.data.path)
        );

        if (existingNodeStartEntryIdx !== -1) {
          entry.id += "_gs";
          entryList.splice(existingNodeStartEntryIdx, 0, entry);
          return;
        }
      }

      entryList.push(entry);
    } else {
      this.historyEntries.push(entry);
    }

    this.requestUpdate();
  }

  #findParentHistoryEntry(path: number[]) {
    let entryList = this.historyEntries;
    for (let idx = 0; idx < path.length - 1; idx++) {
      const id = pathToId(path.slice(0, idx + 1));
      const parentId = entryList.findIndex((item) => item.id === id);
      if (parentId === -1) {
        console.warn(`Unable to find ID "${id}"`);
        return this.historyEntries;
      }

      entryList = entryList[parentId].children;
    }

    return entryList;
  }

  #updateHistoryEntry(event: NodeEndResult) {
    const id = pathToId(event.data.path);
    const entryList = this.#findParentHistoryEntry(event.data.path);
    const existingEntry = entryList.find((item) => item.id === id);
    if (!existingEntry) {
      console.warn(`Unable to find ID "${id}"`);
      return;
    }

    // We may have a nodestart which leads into a graphstart of the same ID, but
    // we'll then receive a graphend before a nodeend against that same ID. This
    // can cause UI confusion so we double check here that if we have a graphend
    // or a nodeend that it tallies with a corresponding graphstart/nodestart.
    const typesMatch =
      existingEntry.type === HistoryEventType.NODESTART &&
      event.type === HistoryEventType.NODEEND;
    if (!typesMatch) {
      return;
    }

    (existingEntry as unknown as NodeEndResult).type = event.type;

    if (existingEntry.graphNodeData && "outputs" in event.data) {
      existingEntry.graphNodeData.outputs = event.data.outputs;
    }

    // Set any 'pending' values to none.
    if (existingEntry.graphNodeData === null) {
      existingEntry.graphNodeData = undefined;
    }

    this.requestUpdate();
  }

  #parseNodeInformation(nodes?: NodeDescriptor[]) {
    this.#nodeInfo.clear();
    if (!nodes) {
      return;
    }

    for (const node of nodes) {
      // The diagram is going to emit IDs without dashes in, so store the config
      // based on the modified ID here.
      this.#nodeInfo.set(node.id, {
        id: node.id,
        type: node.type,
        configuration: node.configuration,
      });
    }
  }

  async load(loadInfo: LoadArgs) {
    this.loadInfo = loadInfo;
    this.#parseNodeInformation(loadInfo.nodes);
    this.#lastHistoryEventTime = globalThis.performance.now();
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

    return response;
  }

  async output(id: string, values: OutputArgs) {
    this.outputs.unshift(new Output(values.outputs));
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

    return response.secret;
  }

  error(message: ErrorResult) {
    this.#createHistoryEntry(message);
  }

  done(message: EndResult) {
    this.#createHistoryEntry(message);
  }

  graphstart(message: ProbeMessage) {
    this.#createHistoryEntry(message);
  }

  graphend(message: ProbeMessage) {
    this.#createHistoryEntry(message);
  }

  nodestart(message: NodeStartResult) {
    this.#createHistoryEntry(message);
  }

  nodeend(message: NodeEndResult) {
    this.#updateHistoryEntry(message);
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
