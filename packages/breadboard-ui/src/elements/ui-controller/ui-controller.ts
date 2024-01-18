/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Board, HistoryEntry, LoadArgs, STATUS } from "../../types/types.js";
import {
  InputEnterEvent,
  MessageTraversalEvent,
  NodeSelectEvent,
  ToastEvent,
  ToastType,
} from "../../events/events.js";
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
import { longTermMemory } from "../../utils/long-term-memory.js";
import { classMap } from "lit/directives/class-map.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { until } from "lit/directives/until.js";

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

type inputCallback = (data: Record<string, unknown>) => void;

const CONFIG_MEMORY_KEY = "ui-config";
const DIAGRAM_DEBOUNCE_RENDER_TIMEOUT = 60;
const VISUALBLOCKS_URL =
  "https://storage.googleapis.com/tfweb/visual-breadboard/visual_breadboard_bin_202401161150.js";

type UIConfig = {
  showNarrowTimeline: boolean;
};

type DiagramElement = HTMLElement & {
  render: (diagram: LoadArgs, highlightedNode: string) => void;
  reset: () => void;
};

@customElement("bb-ui-controller")
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

  @property()
  visualizer: "mermaid" | "visualblocks" = "mermaid";

  @state()
  historyEntries: HistoryEntry[] = [];

  @state()
  selectedNode: ExtendedNodeInformation | null = null;

  @state()
  messages: HarnessRunResult[] = [];

  @state()
  config: UIConfig = {
    showNarrowTimeline: false,
  };

  #diagram: Ref<DiagramElement> = createRef();
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
  #requestedVB = false;

  static styles = uiControllerStyles;

  constructor() {
    super();

    this.#memory.retrieve(CONFIG_MEMORY_KEY).then((value) => {
      if (!value) {
        return;
      }

      this.config = JSON.parse(value) as UIConfig;
    });
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

  async renderDiagram(highlightedDiagramNode = "") {
    if (!this.loadInfo || !this.loadInfo.diagram || !this.#diagram.value) {
      return;
    }

    if (!("render" in this.#diagram.value)) {
      return;
    }

    return this.#diagram.value.render(this.loadInfo, highlightedDiagramNode);
  }

  unloadCurrentBoard() {
    this.url = null;
    this.bootWithUrl = null;
    this.loadInfo = null;
    this.messages.length = 0;
    this.#messagePosition = 0;

    this.#messageDurations.clear();
    this.#nodeInfo.clear();

    if (!this.#diagram.value) {
      return;
    }
    this.#diagram.value.reset();
  }

  firstUpdated() {
    if (this.visualizer === "mermaid") {
      this.style.setProperty("--diagram-display", "flex");
    } else {
      this.style.setProperty("--diagram-display", "block");
    }

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
        return this.#registerInputHandler(data.node.id);
      }

      case "secret": {
        console.log(`Secrets (${data.keys.join(", ")}) requested`);
        return this.#registerSecretsHandler(data.keys);
      }
    }
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

  render() {
    if (!this.loadInfo) {
      return html`Loading board...`;
    }

    this.#scheduleDiagramRender();

    const loadVisualBreadboard = async () => {
      if (!this.#requestedVB) {
        this.#requestedVB = true;
        await loadScript(VISUALBLOCKS_URL);
        this.#scheduleDiagramRender();
      }
      return html`<visual-breadboard
        ${ref(this.#diagram)}
      ></visual-breadboard>`;
    };

    return html`
      <div id="diagram">
        ${
          this.visualizer === "mermaid"
            ? html`<bb-diagram
                ${ref(this.#diagram)}
                @breadboardnodeselect=${(evt: NodeSelectEvent) => {
                  this.selectedNode = this.#nodeInfo.get(evt.id) || null;
                }}
              ></bb-diagram>`
            : html`${until(loadVisualBreadboard(), html`Loading...`)}`
        }
        ${
          this.selectedNode
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
            : nothing
        }
      </div>
      <div id="rhs">
        <section id="timeline" ${ref(this.#timelineRef)}>
          <header>
            <h1>Events</h1>
            <label for="narrow">Narrow</label>
            <input
              name="narrow"
              id="narrow"
              type="checkbox"
              ?checked=${this.config.showNarrowTimeline}
              @input=${() => this.#toggleConfigOption("showNarrowTimeline")}/>
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
            .narrow=${this.config.showNarrowTimeline}
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
            </header>
            <div id="inputs-list">
              <bb-input-list
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
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => {
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
