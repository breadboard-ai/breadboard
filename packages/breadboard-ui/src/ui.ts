/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Board, HistoryEntry, STATUS } from "./types.js";
import {
  BoardUnloadEvent,
  InputEnterEvent,
  MessageTraversalEvent,
  NodeSelectEvent,
  ToastEvent,
  ToastType,
} from "./events.js";
import { LoadArgs } from "./load.js";
import { Diagram } from "./diagram.js";
import {
  AnyRunResult,
  HarnessRunResult,
  InputResult,
  OutputResult,
} from "@google-labs/breadboard/harness";
import { ClientRunResult } from "@google-labs/breadboard/remote";
import {
  NodeConfiguration,
  NodeDescriptor,
  NodeEndProbeMessage,
  NodeStartProbeMessage,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { longTermMemory } from "./utils/long-term-memory.js";
import { classMap } from "lit/directives/class-map.js";

type ExtendedNodeInformation = {
  id: string;
  type: string;
  configuration: NodeConfiguration | undefined;
};

type RunResultWithNodeInfo =
  | ClientRunResult<InputResult>
  | ClientRunResult<OutputResult>
  | ClientRunResult<NodeStartProbeMessage>
  | ClientRunResult<NodeEndProbeMessage>;
const hasNodeInfo = (
  event?: HarnessRunResult
): event is RunResultWithNodeInfo =>
  typeof event === "object" &&
  (event.type === "input" ||
    event.type === "output" ||
    event.type === "nodestart" ||
    event.type === "nodeend");

const enum MODE {
  BUILD = "build",
  PREVIEW = "preview",
}

type inputCallback = (data: Record<string, unknown>) => void;
type UIConfig = {
  showAllInputs: boolean;
};

const CONFIG_MEMORY_KEY = "ui-config";
const DIAGRAM_DEBOUNCE_RENDER_TIMEOUT = 60;

@customElement("bb-ui-manager")
export class UI extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property({ reflect: true })
  bootWithUrl: string | null = null;

  @property({ reflect: true })
  url: string | null = "";

  @property({ reflect: true })
  status = STATUS.RUNNING;

  @property()
  boards: Board[] = [];

  @state()
  toasts: Array<{ message: string; type: ToastType }> = [];

  @state()
  historyEntries: HistoryEntry[] = [];

  @state()
  mode = MODE.BUILD;

  @state()
  selectedNode: ExtendedNodeInformation | null = null;

  @state()
  messages: HarnessRunResult[] = [];

  @state()
  config: UIConfig = {
    showAllInputs: false,
  };

  #diagram = new Diagram();
  #nodeInfo: Map<string, ExtendedNodeInformation> = new Map();
  #timelineRef: Ref<HTMLElement> = createRef();
  #inputRef: Ref<HTMLElement> = createRef();
  #historyRef: Ref<HTMLElement> = createRef();
  #targetElementDivisions: number[] | null = null;
  #resizeTarget: string | null = null;
  #resizeBB: DOMRect | null = null;
  #handlers: Map<string, inputCallback[]> = new Map();
  #memory = longTermMemory;
  #isUpdatingMemory = false;
  #messagePosition = 0;
  #messageDurations: Map<AnyRunResult, number> = new Map();
  #renderTimeout = 0;
  #rendering = false;

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

    * {
      box-sizing: border-box;
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

    #rhs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: var(--rhs-top) 8px var(--rhs-mid) 8px var(
          --rhs-bottom
        );
      column-gap: calc(var(--bb-grid-size) * 2);
      overflow: auto;
    }

    #controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    #run-status {
      font-size: var(--bb-text-pico);
      margin-left: calc(var(--bb-grid-size) * 2);
      text-transform: uppercase;
      text-align: center;
      background: #eee;
      border-radius: calc(var(--bb-grid-size) * 3);
      padding: var(--bb-grid-size);
      font-weight: bold;
      border: 1px solid rgb(230 230 230);
      margin-top: -3px;
      height: 22px;
    }

    #run-status {
      width: 70px;
    }

    #run-status.running {
      border: 1px solid rgb(174 206 161);
      color: rgb(31 56 21);
      background: rgb(223 239 216);
    }

    #run-status.paused {
      border: 1px solid rgb(248 193 122);
      color: rgb(192 116 19);
      background: rgb(255, 242, 204);
    }

    #inputs,
    #outputs,
    #timeline,
    #history {
      border: 1px solid rgb(227, 227, 227);
      border-radius: calc(var(--bb-grid-size) * 5);
      overflow: auto;
      background: rgb(255, 255, 255);
    }

    #timeline,
    #inputs,
    #outputs {
      display: flex;
      flex-direction: column;
    }

    #timeline {
      grid-column: 1 / 3;
    }

    #history {
      display: grid;
      grid-column: 1 / 3;
    }

    .drag-handle {
      cursor: ns-resize;
      grid-column: 1 / 3;
    }

    #timeline h1 {
      font-size: var(--bb-text-small);
      font-weight: bold;
      margin: 0;
    }

    #inputs header,
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

    #timeline header {
      height: calc(var(--bb-grid-size) * 8);
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
      border-bottom: 1px solid rgb(227, 227, 227);
    }

    #timeline header,
    #inputs header {
      display: flex;
    }

    #timeline header h1,
    #inputs header h1 {
      font-size: var(--bb-text-small);
      font-weight: bold;
      margin: 0;
      flex: 1;
    }

    #inputs #input-options {
      display: flex;
    }

    #inputs #input-options input {
      margin: 0 var(--bb-grid-size);
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

    #value {
      min-width: 60px;
      display: flex;
      background: #d1cbff;
      border-radius: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-text-small);
      font-weight: bold;
      height: calc(var(--bb-grid-size) * 5);
      align-items: center;
      justify-content: center;
      margin-left: calc(var(--bb-grid-size) * 2);
      margin-top: calc(var(--bb-grid-size) * -0.5);
    }

    #max {
      font-size: var(--bb-text-pico);
      font-weight: normal;
    }
  `;

  constructor() {
    super();

    this.#diagram.addEventListener(NodeSelectEvent.eventName, (evt: Event) => {
      const nodeSelect = evt as NodeSelectEvent;
      this.selectedNode = this.#nodeInfo.get(nodeSelect.id) || null;
    });

    this.#memory.retrieve(CONFIG_MEMORY_KEY).then((value) => {
      if (!value) {
        return;
      }

      this.config = JSON.parse(value) as UIConfig;
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
    this.toasts.length = 0;
    this.messages.length = 0;
    this.#messagePosition = 0;

    this.#messageDurations.clear();
    this.#nodeInfo.clear();

    this.#diagram.reset();

    this.dispatchEvent(new BoardUnloadEvent());
  }

  firstUpdated() {
    const rowTop = globalThis.sessionStorage.getItem("rhs-top") || "10fr";
    const rowMid = globalThis.sessionStorage.getItem("rhs-mid") || "45fr";
    const rowBottom = globalThis.sessionStorage.getItem("rhs-bottom") || "45fr";

    this.#applyGridRowHeight(rowTop, rowMid, rowBottom);
  }

  #applyGridRowHeight(rowTop: string, rowMid: string, rowBottom: string) {
    this.style.setProperty(`--rhs-top`, rowTop);
    this.style.setProperty(`--rhs-mid`, rowMid);
    this.style.setProperty(`--rhs-bottom`, rowBottom);
  }

  #startVerticalResize(evt: PointerEvent) {
    if (!(evt.target instanceof HTMLElement)) {
      return;
    }

    evt.target.setPointerCapture(evt.pointerId);

    this.#resizeTarget = evt.target.dataset.control || null;
    if (
      !(
        this.#resizeTarget &&
        this.#inputRef.value &&
        this.#historyRef.value &&
        this.#timelineRef.value
      )
    ) {
      return;
    }

    const rhsTop = this.style.getPropertyValue("--rhs-top") || "10fr";
    const rhsMid = this.style.getPropertyValue("--rhs-mid") || "45fr";
    const rhsBottom = this.style.getPropertyValue("--rhs-bottom") || "45fr";

    this.#targetElementDivisions = [
      parseFloat(rhsTop),
      parseFloat(rhsMid),
      parseFloat(rhsBottom),
    ];

    const timelineBB = this.#timelineRef.value.getBoundingClientRect();
    const inputBB = this.#inputRef.value.getBoundingClientRect();
    const historyBB = this.#historyRef.value.getBoundingClientRect();

    switch (this.#resizeTarget) {
      case "upper":
        this.#resizeBB = new DOMRect(
          timelineBB.x,
          timelineBB.top,
          timelineBB.width,
          inputBB.bottom - timelineBB.top
        );
        break;

      case "lower":
        this.#resizeBB = new DOMRect(
          inputBB.x,
          inputBB.top,
          historyBB.width,
          historyBB.bottom - inputBB.top
        );
        break;

      default:
        console.warn(`Unexpected resize target: ${this.#resizeTarget}`);
        break;
    }
  }

  #onVerticalResize(evt: PointerEvent) {
    if (
      this.#resizeBB === null ||
      this.#resizeTarget === null ||
      this.#targetElementDivisions === null
    ) {
      return;
    }

    let normalizedY = (evt.pageY - this.#resizeBB.top) / this.#resizeBB.height;
    if (normalizedY < 0.1) {
      normalizedY = 0.1;
    } else if (normalizedY > 0.9) {
      normalizedY = 0.9;
    }

    let top = this.#targetElementDivisions[0];
    let mid = this.#targetElementDivisions[1];
    let bottom = this.#targetElementDivisions[2];

    switch (this.#resizeTarget) {
      case "upper": {
        const total = top + mid;
        top = normalizedY * total;
        mid = (1 - normalizedY) * total;
        break;
      }

      case "lower": {
        const total = mid + bottom;
        mid = normalizedY * total;
        bottom = (1 - normalizedY) * total;
        break;
      }
    }

    this.#applyGridRowHeight(`${top}fr`, `${mid}fr`, `${bottom}fr`);
  }

  #endVerticalResize() {
    if (!this.#resizeBB) {
      return;
    }

    this.#resizeBB = null;

    const rhsTop = this.style.getPropertyValue("--rhs-top");
    const rhsMid = this.style.getPropertyValue("--rhs-mid");
    const rhsBottom = this.style.getPropertyValue("--rhs-bottom");

    globalThis.sessionStorage.setItem("rhs-top", rhsTop);
    globalThis.sessionStorage.setItem("rhs-mid", rhsMid);
    globalThis.sessionStorage.setItem("rhs-bottom", rhsBottom);
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
  }

  async #registerInputHandler(id: string): Promise<Record<string, unknown>> {
    const handlers = this.#handlers.get(id);
    if (!handlers) {
      return Promise.reject(`Unable to set up handler for input ${id}`);
    }

    return new Promise((resolve) => {
      handlers.push((data: Record<string, unknown>) => {
        resolve(data);
      });
    });
  }

  async #registerSecretsHandler(
    keys: string[]
  ): Promise<Record<string, unknown>> {
    const values = await Promise.all(
      keys.map((key) => {
        return new Promise<[string, unknown]>((resolve) => {
          const callback = ({ secret }: Record<string, unknown>) => {
            resolve([key, secret]);
          };
          this.#handlers.set(key, [callback]);
        });
      })
    );

    return Object.fromEntries(values);
  }

  async handleStateChange(
    message: HarnessRunResult,
    duration: number
  ): Promise<Record<string, unknown> | void> {
    // Store it for later, render, then actually handle the work.
    this.messages.push(message);
    if (this.status === STATUS.RUNNING) {
      this.#messagePosition = this.messages.length - 1;
    }
    this.#messageDurations.set(message, duration);
    this.requestUpdate();

    const { data, type } = message;
    switch (type) {
      case "nodestart": {
        console.log(
          `Initialize nodestart handlers for (id="${data.node.id}", type="${data.node.type}")`
        );
        if (!this.#handlers.has(data.node.id)) {
          this.#handlers.set(data.node.id, []);
        }
        return;
      }

      case "nodeend": {
        console.log(`Clear nodestart handlers for input(id="${data.node.id}")`);
        this.#handlers.delete(data.node.id);
        return;
      }

      case "input": {
        console.log(`Input (id="${data.node.id}") requested`);
        console.log("DATA", data.inputArguments);
        return this.#registerInputHandler(data.node.id);
      }

      case "secret": {
        console.log(`Secrets (${data.keys.join(", ")}) requested`);
        return this.#registerSecretsHandler(data.keys);
      }
    }
  }

  async #toggleConfigOption(key: keyof UIConfig) {
    if (this.#isUpdatingMemory) {
      return;
    }

    this.#isUpdatingMemory = true;
    this.config[key] = !this.config[key];
    await this.#memory.store(CONFIG_MEMORY_KEY, JSON.stringify(this.config));
    this.#isUpdatingMemory = false;

    this.requestUpdate();
  }

  #scheduleDiagramRender() {
    // We do a debounced render here because rendering the Mermaid chart it very
    // expensive, and we can't keep on top of the animation if we render it on
    // demand.
    clearTimeout(this.#renderTimeout);
    this.#renderTimeout = window.setTimeout(async () => {
      if (this.#rendering) {
        this.#scheduleDiagramRender();
        return;
      }

      const message = this.messages[this.#messagePosition];
      const nodeId = hasNodeInfo(message) ? message.data.node.id : "";
      this.#rendering = true;
      await this.renderDiagram(nodeId);
      this.#rendering = false;
    }, DIAGRAM_DEBOUNCE_RENDER_TIMEOUT);
  }

  #renderContent() {
    if (!this.loadInfo) {
      return html`Loading board...`;
    }

    switch (this.mode) {
      case MODE.BUILD: {
        this.#scheduleDiagramRender();

        return html`<div id="diagram">
            ${this.loadInfo.diagram ? this.#diagram : "No board diagram"}
            ${
              this.selectedNode
                ? html`<div id="node-information">
                    <h1>Node Information</h1>
                    <button
                      id="close"
                      @click=${() => (this.selectedNode = null)}
                    >
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
                : nothing
            }
          </div>
          <div id="rhs">
            <section id="timeline" ${ref(this.#timelineRef)}>
              <header>
                <h1>Events</h1>
                <div id="value">${Math.min(
                  this.messages.length,
                  this.#messagePosition + 1
                )} /
                <span id="max">&nbsp;${this.messages.length}</span></div>
                <div id="run-status" class=${classMap({ [this.status]: true })}>
                  ${this.status}
                </div>
              </header>
              <bb-timeline-controls
                .messages=${this.messages}
                .messagePosition=${this.#messagePosition}
                .messageDurations=${this.#messageDurations}
                @breadboardmessagetraversal=${(evt: MessageTraversalEvent) => {
                  if (evt.index < 0 || evt.index > this.messages.length) {
                    return;
                  }

                  this.#messagePosition = evt.index;
                  this.requestUpdate();
                }}
              ></bb-timeline-controls>
            </section>
            <div
              class="drag-handle"
              data-control="upper"
              @pointerdown=${this.#startVerticalResize}
              @pointermove=${this.#onVerticalResize}
              @pointerup=${this.#endVerticalResize}
            ></div>
            <section id="inputs" ${ref(this.#inputRef)}>
                <header>
                  <h1>Inputs</h1>
                  <div id="input-options">
                    <label for="show-all-inputs">Show all inputs</label>
                    <input
                      type="checkbox"
                      id="show-all-inputs"
                      ?checked=${this.config.showAllInputs}
                      @input=${() => this.#toggleConfigOption("showAllInputs")}
                    />
                  </div>
                </header>
                <div id="inputs-list">
                  <bb-input-list
                    .showAllInputs=${this.config.showAllInputs}
                    .messages=${this.messages}
                    .messagePosition=${this.#messagePosition}
                    @breadboardinputenter=${(event: InputEnterEvent) => {
                      // Notify any pending handlers that the input has arrived.
                      if (this.#messagePosition < this.messages.length - 1) {
                        // The user has attempted to provide input for a stale
                        // request.
                        // TODO: Enable resuming from this point.
                        this.dispatchEvent(
                          new ToastEvent(
                            "Unable to submit: board evaluation has already passed this point",
                            ToastType.ERROR
                          )
                        );
                        return;
                      }

                      const data = event.data;
                      const handlers = this.#handlers.get(event.id) || [];
                      if (handlers.length === 0) {
                        console.warn(
                          `Received event for input(id="${event.id}") but no handlers were found`
                        );
                      }
                      for (const handler of handlers) {
                        handler.call(null, data);
                      }
                    }}
                  ></bb-input-list>
                </div>
              </section>
              <section id="outputs">
                <h1>Outputs</h1>
                <div id="outputs-list">
                  <bb-output-list
                    .messages=${this.messages}
                    .messagePosition=${this.#messagePosition}
                  ></bb-output-list>
                </div>
              </section>
              <div
                class="drag-handle"
                data-control="lower"
                @pointerdown=${this.#startVerticalResize}
                @pointermove=${this.#onVerticalResize}
                @pointerup=${this.#endVerticalResize}
              ></div>
              <div id="history" ${ref(this.#historyRef)}>
                <bb-history-tree
                  .messages=${this.messages}
                  .messagePosition=${this.#messagePosition}
                ></bb-history-tree>
              </div>
            </section>
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
        <div id="content" class="${this.mode}">${this.#renderContent()}</div>`;
    } else {
      tmpl = html`<header>
          <a href="/"><h1 id="title">Breadboard Playground</h1></a>
        </header>
        <bb-board-list
          .boards=${this.boards}
          .bootWithUrl=${this.bootWithUrl}
        ></bb-board-list>`;
    }

    return html`${tmpl} ${toasts}`;
  }
}
