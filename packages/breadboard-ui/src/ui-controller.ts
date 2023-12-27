/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Input, type InputArgs } from "./input.js";
import { Load, type LoadArgs } from "./load.js";
import { Output, type OutputArgs } from "./output.js";
import { ResultArgs } from "./result.js";
import {
  DelayEvent,
  InputEnterEvent,
  NodeSelectEvent,
  StartEvent,
  type ToastType,
} from "./events.js";
import { Toast } from "./toast.js";
import { InputContainer } from "./input-container.js";
import { Diagram } from "./diagram.js";
import {
  assertHTMLElement,
  assertRoot,
  assertSelectElement,
} from "./utils/assertions.js";
import {
  HistoryEventType,
  HistoryEvent,
  PrimordialHistoryEvent,
  GraphEndHistoryEvent,
  GraphStartHistoryEvent,
  BeforehandlerHistoryEvent,
  AfterhandlerHistoryEvent,
} from "./types.js";
import { HistoryEntry } from "./history-entry.js";
import { NodeConfiguration, NodeDescriptor } from "@google-labs/breadboard";
import { BeforehandlerResponse } from "@google-labs/breadboard/remote";
import { AfterhandlerResponse } from "@google-labs/breadboard/harness";

export interface UI {
  beforehandler(data: BeforehandlerResponse): void;
  afterhandler(data: AfterhandlerResponse): void;
  output(values: OutputArgs): void;
  input(id: string, args: InputArgs): Promise<Record<string, unknown>>;
  error(message: string): void;
  done(): void;
}

interface HistoryLogItem {
  type: string;
  summary: string;
  id: string | null;
  data: unknown | null;
  elapsedTime: number;
}

const hasPath = (
  event: PrimordialHistoryEvent
): event is
  | GraphEndHistoryEvent
  | GraphStartHistoryEvent
  | BeforehandlerHistoryEvent
  | AfterhandlerHistoryEvent =>
  event.type === HistoryEventType.BEFOREHANDLER ||
  event.type === HistoryEventType.AFTERHANDLER ||
  event.type === HistoryEventType.GRAPHSTART ||
  event.type === HistoryEventType.GRAPHEND;

const pathToId = (path: number[]) => `path-${path.join("-")}`;

export class UIController extends HTMLElement implements UI {
  #inputContainer = new InputContainer();
  #nodeInformation: HTMLElement;
  #currentBoardDiagram = "";
  #diagram = new Diagram();
  #lastHistoryEventTime = Number.NaN;
  #historyLog: HistoryLogItem[] = [];
  #nodeInfo: Map<
    string,
    { type: string; configuration: NodeConfiguration | undefined }
  > = new Map();

  constructor() {
    super();

    const toggleMapping = ["history", "output", "input"];
    const isExpanded = new Map(
      toggleMapping.map((id) => {
        return [id, this.#getRememberedValue(`ui-${id}-active`, true)];
      })
    );

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          padding: calc(var(--bb-grid-size) * 4) calc(var(--bb-grid-size) * 8)
              calc(var(--bb-grid-size) * 8) calc(var(--bb-grid-size) * 8);
          box-sizing: border-box;
          overflow: hidden;
        }

        :host * {
          box-sizing: border-box;
        }

        #wrapper {
          border-radius: calc(var(--bb-grid-size) * 9);
          border: 2px solid #E3E7ED;
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-columns: 65fr 35fr;
          overflow: hidden;
        }

        #diagram {
          border-radius: calc(var(--bb-grid-size) * 9);
          overflow: hidden;
          outline: 2px solid #E3E7ED;
          display: none;
          position: relative;
        }

        #diagram.active {
          display: block;
        }

        :host(.paused) #diagram::after {
          height: calc(var(--bb-grid-size) * 8);
          line-height: calc(var(--bb-grid-size) * 8);
          text-align: center;
          background: rgb(255, 242, 204);
          border-bottom: 1px solid rgb(255, 195, 115);
          content: 'This board is paused';
          position: absolute;
          width: 100%;
          top: 0;
          left: 0;
          font-size: var(--bb-text-small);
        }

        #diagram-container {
          width: 100%;
          height: 100%;
          overflow: auto;
        }

        #intro {
          display: none;
          grid-column: 1/3;
          background: rgb(244, 247, 252);
          border-radius: calc(var(--bb-grid-size) * 9);
          padding: calc(var(--bb-grid-size) * 8);
        }

        #intro > #contents {
          max-width: 600px;
        }

        #intro p {
          line-height: 1.5;
        }

        #intro.active {
          display: block;
        }

        #sidebar {
          display: none;
        }

        #sidebar.active {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        #controls {
          height: calc(var(--bb-grid-size) * 14);
          flex: 0 0 auto;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          border-bottom: 1px solid rgb(227, 231, 237);
          padding-right: calc(var(--bb-grid-size) * 6);
        }

        #history,
        #output,
        #input {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        #history.active,
        #output.active,
        #input.active {
          flex: 1;
        }

        #history, #output {
          border-top: 1px solid rgb(227, 231, 237);
        }

        #history h1,
        #output h1,
        #input h1 {
          font-size: var(--bb-text-medium);
          margin: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2);
          font-weight: 400;
          padding: 0 0 0 calc(var(--bb-grid-size) * 8);
          line-height: calc(var(--bb-grid-size) * 6);
          cursor: pointer;
          opacity: 0.6;
        }

        #history.active h1,
        #history h1:hover,
        #output.active h1,
        #output h1:hover,
        #input.active h1,
        #input h1:hover {
          opacity: 1;
        }

        #history h1 {
          background: var(--bb-icon-history) 0 0 no-repeat;
          display: flex;
        }

        #history h1 span {
          flex: 1;
        }

        #output h1 {
          background: var(--bb-icon-output) 0 0 no-repeat;
        }

        #input h1 {
          background: var(--bb-icon-input) 0 0 no-repeat;
        }

        #history-list,
        #output-list,
        #input-list {
          display: none;
          scrollbar-gutter: stable;
          overflow-y: auto;
          flex: 1;
        }

        #history.active #history-list,
        #output.active #output-list,
        #input.active #input-list {
          display: block;
        }

        #input-list {
          border-top: 1px solid rgb(240, 240, 240);
        }

        #history-list:empty::before,
        #output-list:empty::before,
        #input-list:empty::before {
          font-size: var(--bb-text-small);
          padding: calc(var(--bb-grid-size) * 5);
          padding-left: calc(var(--bb-grid-size) * 3 - 1px);
        }

        #history-list:empty::before {
          content: 'No nodes have run yet';
        }

        #output-list:empty::before {
          content: 'No board outputs received yet';
        }

        #input-list:empty::before {
          content: 'No active board inputs';
        }

        #response-container > #intro > h1 {
          font-size: var(--bb-text-xx-large);
          margin: 0 0 calc(var(--bb-grid-size) * 6) 0;
          display: inline-block;
          background: linear-gradient(
            45deg,
            rgb(90, 64, 119),
            rgb(144, 68, 228)
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        #response-container > #intro > p {
          max-width: calc(var(--bb-grid-size) * 125);
          margin: 0 0 calc(var(--bb-grid-size) * 5) 0;
          line-height: 1.5;
        }

        #response-container a {
          color: var(--bb-font-color);
          font-weight: 700;
        }

        #new-here {
          font-size: var(--bb-text-small);
        }

        #url-input-container {
          margin-top: calc(var(--bb-grid-size) * 10);
          position: relative;
        }

        #url-input {
          border-radius: calc(var(--bb-grid-size) * 10);
          background: rgb(255, 255, 255);
          height: calc(var(--bb-grid-size) * 12);
          padding: 0 calc(var(--bb-grid-size) * 10) 0 calc(var(--bb-grid-size) * 4);
          width: 100%;
          border: 1px solid rgb(209, 209, 209);
        }

        #url-submit {
          font-size: 0;
          width: calc(var(--bb-grid-size) * 8);
          height: calc(var(--bb-grid-size) * 8);
          position: absolute;
          right: calc(var(--bb-grid-size) * 2);
          top: calc(var(--bb-grid-size) * 2);
          border-radius: 50%;
          background: #FFF var(--bb-icon-start) center center no-repeat;
          border: none;
        }

        #delay {
          width: auto;
          max-width: calc(var(--bb-grid-size) * 50);
          padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
          padding-left: 30px;
          border-radius: 30px;
          background: rgb(255, 255, 255) var(--bb-icon-delay) 5px 4px no-repeat;
          border: 1px solid rgb(200, 200, 200);
        }

        #download-history-log {
          font-size: var(--bb-text-nano);
          color: #888;
        }

        #node-information:empty {
          display: none;
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
          box-shadow: 0 2px 3px 0 rgba(0,0,0,0.13),
            0 7px 9px 0 rgba(0,0,0,0.16);
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
      </style>
      <!-- Load info -->
      <div id="load-container">
        <slot name="load"></slot>
      </div>

      <div id="wrapper">
        <!-- Intro -->
        <div id="intro">
          <div id="contents">
            <h1>Hello there!</h1>
            <p>This is the <strong>Breadboard Playground</strong> running in the browser. Here you can either try out one of the sample boards, or you can enter the URL for your own board below.</p>

            <p id="new-here">New here? Read more about the <a href="https://github.com/breadboard-ai/breadboard/tree/main">Breadboard project on Github</a>.</p>

            <form>
              <div id="url-input-container">
                <input required id="url-input" type="url" name="url" placeholder="Enter a Board URL" />
                <input id="url-submit" type="submit" />
              </div>
            </form>
          </div>
        </div>

        <!-- Diagram -->
        <div id="diagram">
          <div id="diagram-container"></div>
          <div id="node-information"></div>
        </div>

        <!-- Sidebar -->
        <div id="sidebar">
          <div id="controls">
            <select id="delay">
              <option>No delay</option>
              <option>250ms delay</option>
              <option>500ms delay</option>
              <option>1000ms delay</option>
              <option>1500ms delay</option>
            </select>
          </div>
          <div id="input" class="${isExpanded.get("input") ? "active" : ""}">
            <h1>Inputs</h1>
            <div id="input-list" class="active">
              <slot></slot>
            </div>
          </div>
          <div id="output" class="${isExpanded.get("output") ? "active" : ""}">
            <h1>Outputs</h1>
            <div id="output-list" class="active"></div>
          </div>
          <div id="history" class="${
            isExpanded.get("history") ? "active" : ""
          }">
            <h1>
              <span>History</span>
              <a href="#" id="download-history-log" download="history-log.json">Download log</a>
            </h1>
            <div id="history-list" class="active"></div>
          </div>
        </div>
      </div>
    `;

    const nodeInformation = root.querySelector("#node-information");
    assertHTMLElement(nodeInformation);
    this.#nodeInformation = nodeInformation;
    this.#nodeInformation.addEventListener("click", (evt: Event) => {
      if (!(evt.target instanceof HTMLElement)) {
        return;
      }

      if (evt.target.id === "close") {
        this.#clearNodeInformation();
      }
    });

    this.appendChild(this.#inputContainer);

    const diagramContainer = root.querySelector("#diagram-container");
    const delay = root.querySelector("#delay");
    assertHTMLElement(diagramContainer);
    assertSelectElement(delay);

    diagramContainer.appendChild(this.#diagram);
    this.#diagram.addEventListener(NodeSelectEvent.eventName, (evt: Event) => {
      const nodeSelect = evt as NodeSelectEvent;
      this.#showNodeInformation(nodeSelect.id);
    });

    delay.addEventListener("change", () => {
      this.dispatchEvent(new DelayEvent(parseFloat(delay.value)));
    });

    const downloadLog = root.querySelector("#download-history-log");
    assertHTMLElement(downloadLog);
    downloadLog.addEventListener("click", (evt: Event) => {
      evt.stopImmediatePropagation();

      const currentLink = downloadLog.getAttribute("href");
      if (currentLink) {
        URL.revokeObjectURL(currentLink);
      }

      const contents = JSON.stringify(this.#historyLog, null, 2);
      const file = new Blob([contents], { type: "application/json" });
      downloadLog.setAttribute("download", `history-log-${Date.now()}.json`);
      downloadLog.setAttribute("href", URL.createObjectURL(file));
    });

    for (const target of toggleMapping) {
      const element = root.querySelector(`#${target} > h1`);
      const targetElement = root.querySelector(`#${target}`);
      assertHTMLElement(element);
      assertHTMLElement(targetElement);

      element.addEventListener("click", () => {
        targetElement.classList.toggle("active");
        this.#rememberValue(
          `ui-${target}-active`,
          targetElement.classList.contains("active")
        );
      });
    }
  }

  toast(message: string, type: ToastType) {
    const toast = new Toast();
    toast.message = message;
    toast.type = type;
    document.body.appendChild(toast);
  }

  showPaused() {
    this.classList.add("paused");
  }

  hidePaused() {
    this.classList.remove("paused");
  }

  #getLocalStorageKey(id: string) {
    return `bb-remember-${id}`;
  }

  #getRememberedValue<T>(id: string, defaultValue: T): T {
    const key = this.#getLocalStorageKey(id);
    const data = localStorage.getItem(key);
    if (!data) {
      this.#rememberValue(id, defaultValue);
      return defaultValue;
    }

    return JSON.parse(data) as T;
  }

  #rememberValue(id: string, data: unknown) {
    const key = this.#getLocalStorageKey(id);
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    return;
  }

  #showNodeInformation(id: string) {
    this.#clearNodeInformation();

    const nodeInfo = this.#nodeInfo.get(id);
    if (!nodeInfo) {
      return;
    }

    const title = document.createElement("h1");
    title.textContent = "Node information";
    this.#nodeInformation.appendChild(title);

    const close = document.createElement("button");
    close.id = "close";
    close.textContent = "Close";
    this.#nodeInformation.appendChild(close);

    const headerInfo = document.createElement("dl");
    const nodeId = document.createElement("dd");
    const nodeIdValue = document.createElement("dt");
    const type = document.createElement("dd");
    const typeValue = document.createElement("dt");
    const configuration = document.createElement("dd");
    const configurationValue = document.createElement("dt");
    const configurationValuePre = document.createElement("pre");

    nodeId.textContent = "ID";
    nodeIdValue.textContent = id;

    type.textContent = "Type";
    typeValue.textContent = nodeInfo.type;

    configuration.textContent = "Configuration";
    configurationValue.appendChild(configurationValuePre);
    configurationValuePre.textContent = JSON.stringify(
      nodeInfo.configuration || "No node configuration found",
      null,
      2
    );

    headerInfo.appendChild(nodeId);
    headerInfo.appendChild(nodeIdValue);
    headerInfo.appendChild(type);
    headerInfo.appendChild(typeValue);
    headerInfo.appendChild(configuration);
    headerInfo.appendChild(configurationValue);

    this.#nodeInformation.appendChild(headerInfo);
  }

  #clearNodeInformation() {
    const children = Array.from(this.#nodeInformation.querySelectorAll("*"));
    for (const child of children) {
      child.remove();
    }
  }

  #clearBoardContents() {
    this.#inputContainer.clearContents();

    const root = this.shadowRoot;
    assertRoot(root);

    const children = Array.from(this.children);
    for (const child of children) {
      if (child.tagName === "HEADER" || child === this.#inputContainer) {
        continue;
      }
      child.remove();
    }

    const outputList = root.querySelectorAll(
      "#output-list > *, #history-list > *"
    );
    for (const child of Array.from(outputList)) {
      child.remove();
    }
  }

  showIntroContent() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#intro")?.classList.add("active");

    const form = root.querySelector("form");
    form?.addEventListener("submit", (evt: Event) => {
      evt.preventDefault();
      const data = new FormData(form);
      const url = data.get("url");
      if (!url) {
        throw new Error("Unable to located url in form data");
      }

      this.dispatchEvent(new StartEvent(url.toString()));
    });
  }

  #hideIntroContent() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#intro")?.classList.remove("active");
  }

  #showBoardContainer() {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in UI Controller");
    }

    root.querySelector("#sidebar")?.classList.add("active");
    root.querySelector("#diagram")?.classList.add("active");
  }

  #autoShowInput() {
    const root = this.shadowRoot;
    assertRoot(root);

    const input = root.querySelector("#input");
    assertHTMLElement(input);

    input.classList.add("active");
    this.#rememberValue(`ui-input-active`, true);
  }

  #createHistoryEntry(event: HistoryEvent) {
    const { type, summary = "", id = null, data } = event;
    if (Number.isNaN(this.#lastHistoryEventTime)) {
      this.#lastHistoryEventTime = globalThis.performance.now();
    }

    const root = this.shadowRoot;
    assertRoot(root);

    // find the right parent to insert the new history entry before.
    const findParent = () => {
      if (hasPath(event)) {
        let path = event.data.path;
        do {
          path = path.slice(0, -1);
          const parent = root.querySelector(`#${pathToId(path)}`);
          if (parent) return parent;
        } while (path.length);
      }
      return root.querySelector("#history-list");
    };

    const historyList = findParent();
    assertHTMLElement(historyList);

    const elapsedTime =
      globalThis.performance.now() - this.#lastHistoryEventTime;
    this.#lastHistoryEventTime = globalThis.performance.now();

    const createId = () => {
      return hasPath(event) ? pathToId(event.data.path) : id || "";
    };

    const historyEntry = new HistoryEntry();
    historyEntry.type = type;
    historyEntry.summary = summary || "";
    historyEntry.id = createId();
    historyEntry.nodeId = id || "";
    historyEntry.data = hasPath(event) ? null : data;
    historyEntry.elapsedTime = elapsedTime;

    this.#historyLog.push({ type, summary, id, data, elapsedTime });

    if (historyList.childNodes.length) {
      historyList.insertBefore(historyEntry, historyList.firstChild);
    } else {
      historyList.appendChild(historyEntry);
    }
  }

  #updateHistoryEntry({ type, data }: HistoryEvent) {
    const root = this.shadowRoot;
    assertRoot(root);

    const historyList = root.querySelector("#history-list");
    assertHTMLElement(historyList);

    if (type !== HistoryEventType.AFTERHANDLER) {
      throw new Error("Only AFTERHANDLER events can be used to update history");
    }

    const selector = `#${pathToId(data.path)}`;
    const historyEntry = historyList.querySelector(selector) as HistoryEntry;
    assertHTMLElement(historyEntry);

    historyEntry.type = type;
    historyEntry.data = data.outputs;
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
        type: node.type,
        configuration: node.configuration,
      });
    }
  }

  load(info: LoadArgs) {
    this.#currentBoardDiagram = info.diagram || "";

    this.#hideIntroContent();
    this.#clearBoardContents();
    this.#showBoardContainer();
    this.#clearNodeInformation();

    const { title, description = "", version = "", url = "" } = info;
    const load = new Load();

    load.title = title || "Untitled";
    load.description = description;
    load.version = version;
    load.url = url;
    load.slot = "load";
    this.appendChild(load);
    this.#diagram.reset();

    this.#parseNodeInformation(info.nodes);

    this.#historyLog.length = 0;
    this.#lastHistoryEventTime = globalThis.performance.now();
    this.#createHistoryEntry({
      type: HistoryEventType.LOAD,
      summary: "Board loaded",
      data: info.url,
    });
  }

  async renderDiagram(highlightNode = "") {
    if (!this.#currentBoardDiagram) {
      return;
    }

    return this.#diagram.render(this.#currentBoardDiagram, highlightNode);
  }

  beforehandler(data: BeforehandlerResponse) {
    const {
      path,
      node: { id, type },
    } = data;
    this.#createHistoryEntry({
      type: HistoryEventType.BEFOREHANDLER,
      summary: type,
      id,
      data: { path },
    });
  }

  afterhandler(data: AfterhandlerResponse) {
    const {
      path,
      node: { id },
      outputs,
    } = data;
    this.#updateHistoryEntry({
      type: HistoryEventType.AFTERHANDLER,
      id,
      data: { path, outputs },
    });
  }

  async output(values: OutputArgs) {
    this.#createHistoryEntry({
      type: HistoryEventType.OUTPUT,
      summary: "Output",
      id: values.node.id,
      data: values.outputs,
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputContainer = this.shadowRoot!.querySelector("#output-list");
    const output = new Output();
    outputContainer?.appendChild(output);

    await output.display(values.outputs);
  }

  async secret(id: string): Promise<string> {
    this.#autoShowInput();

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

      if (this.#inputContainer.childNodes.length) {
        this.#inputContainer.insertBefore(
          input,
          this.#inputContainer.firstChild
        );
      } else {
        this.#inputContainer.appendChild(input);
      }

      input.addEventListener(InputEnterEvent.eventName, (evt: Event) => {
        const inputEvent = evt as InputEnterEvent;
        resolve(inputEvent.data as Record<string, string>);

        input.remove();
      });
    });

    this.#createHistoryEntry({
      type: HistoryEventType.SECRETS,
      summary: `secrets`,
      id,
    });

    return response.secret;
  }

  result(value: ResultArgs, id = null) {
    this.#createHistoryEntry({
      type: HistoryEventType.RESULT,
      summary: value.title,
      id,
      data: value.result || null,
    });
  }

  async input(id: string, args: InputArgs): Promise<Record<string, unknown>> {
    this.#autoShowInput();

    const response: Record<string, unknown> = await new Promise((resolve) => {
      const input = new Input();
      input.id = id;
      input.args = args;

      input.addEventListener(InputEnterEvent.eventName, (evt: Event) => {
        const inputEvent = evt as InputEnterEvent;
        resolve(inputEvent.data);
      });

      if (this.#inputContainer.childNodes.length) {
        this.#inputContainer.insertBefore(
          input,
          this.#inputContainer.firstChild
        );
      } else {
        this.#inputContainer.appendChild(input);
      }
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
}
