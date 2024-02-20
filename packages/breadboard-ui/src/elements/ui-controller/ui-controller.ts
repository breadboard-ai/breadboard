/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Board, HistoryEntry, LoadArgs, STATUS } from "../../types/types.js";
import {
  InputEnterEvent,
  MessageTraversalEvent,
  ToastEvent,
  ToastType,
} from "../../events/events.js";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import { Kit, NodeConfiguration } from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { longTermMemory } from "../../utils/long-term-memory.js";
import { classMap } from "lit/directives/class-map.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { type InputList } from "../input/input-list/input-list.js";
import { NodeHighlightHelper } from "../../utils/highlights.js";
import { Splitter, ORIENTATION } from "../splitter/splitter.js";

type ExtendedNodeInformation = {
  id: string;
  type: string;
  configuration: NodeConfiguration | undefined;
};

type inputCallback = (data: Record<string, unknown>) => void;

const CONFIG_MEMORY_KEY = "ui-config";

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

  @property()
  kits: Kit[] = [];

  @property({ reflect: true })
  url: string | null = "";

  @property({ reflect: true })
  status = STATUS.RUNNING;

  @property()
  boards: Board[] = [];

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

  #mainSplitter: Ref<Splitter> = createRef();
  #diagram: Ref<DiagramElement> = createRef();
  #nodeInfo: Map<string, ExtendedNodeInformation> = new Map();
  #timelineRef: Ref<HTMLElement> = createRef();
  #inputRef: Ref<HTMLElement> = createRef();
  #inputListRef: Ref<InputList> = createRef();
  #handlers: Map<string, inputCallback[]> = new Map();
  #memory = longTermMemory;
  #isUpdatingMemory = false;
  #messagePosition = 0;
  #messageDurations: Map<HarnessRunResult, number> = new Map();
  #highlightHelper = new NodeHighlightHelper();
  #resizeObserver = new ResizeObserver(() => {
    if (!this.#mainSplitter.value) {
      return;
    }

    if (window.matchMedia("(orientation: portrait)").matches) {
      if (this.#mainSplitter.value.orientation === ORIENTATION.HORIZONTAL) {
        this.#mainSplitter.value.orientation = ORIENTATION.VERTICAL;
      }
    } else {
      if (this.#mainSplitter.value.orientation === ORIENTATION.VERTICAL) {
        this.#mainSplitter.value.orientation = ORIENTATION.HORIZONTAL;
      }
    }
  });

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

  connectedCallback(): void {
    super.connectedCallback();
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
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

  clearMessages() {
    this.messages.length = 0;
    this.#highlightHelper.clear();
    this.#messagePosition = 0;
  }

  unloadCurrentBoard() {
    this.url = null;
    this.loadInfo = null;
    this.clearMessages();

    this.#messageDurations.clear();
    this.#nodeInfo.clear();

    if (!this.#diagram.value) {
      return;
    }
    this.#diagram.value.reset();
  }

  async load(loadInfo: LoadArgs) {
    this.loadInfo = loadInfo;
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
    this.#highlightHelper.add(message);
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

      case "error": {
        console.error(`Error:`, data.error);
        return;
      }
    }
  }

  #notifyInputList(evt: Event) {
    if (!this.#inputListRef.value) {
      return;
    }

    evt.preventDefault();
    evt.stopImmediatePropagation();
    this.#inputListRef.value.captureNewestInput();
  }

  render() {
    const typeOfNewestMessage = this.messages[this.messages.length - 1]?.type;
    const disabled =
      this.#messagePosition < this.messages.length - 1 ||
      (typeOfNewestMessage !== "input" && typeOfNewestMessage !== "secret");

    const continueButton = html`<button
      id="continue"
      ?disabled=${disabled}
      @click=${this.#notifyInputList}
    >
      Continue
    </button>`;

    const mainIsVertical = window.matchMedia("(orientation: portrait)").matches;
    const nodeId = this.#highlightHelper.currentNode(this.#messagePosition);

    return html` <bb-splitter
      orientation="vertical"
      name="main"
      split=${mainIsVertical ? "0.45" : "0.66"}
      ${ref(this.#mainSplitter)}
    >
      <bb-splitter
        orientation="vertical"
        name="diagram-timeline"
        split=${mainIsVertical ? "0.7" : "0.9"}
        slot="a"
      >
        <div id="diagram" slot="a">
          <bb-editor
            .editable=${this.url === null}
            .loadInfo=${this.loadInfo}
            .kits=${this.kits}
            .highlightedNodeId=${nodeId}
            .nodeCount=${this.loadInfo?.graphDescriptor?.nodes.length || 0}
            .edgeCount=${this.loadInfo?.graphDescriptor?.edges.length || 0}
            ${ref(this.#diagram)}
          ></bb-editor>
        </div>
        <section id="timeline" ${ref(this.#timelineRef)} slot="b">
          <header>
            <h1>Events</h1>
            <label for="narrow">Narrow</label>
            <input
              name="narrow"
              id="narrow"
              type="checkbox"
              ?checked=${this.config.showNarrowTimeline}
              @input=${() => this.#toggleConfigOption("showNarrowTimeline")}
            />
            <div id="value">
              ${Math.min(this.messages.length, this.#messagePosition + 1)} /
              <span id="max">&nbsp;${this.messages.length}</span>
            </div>
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
      </bb-splitter>

      <bb-splitter orientation="vertical" name="io-history" slot="b">
        <bb-splitter orientation="horizontal" name="io" slot="a">
          <section id="inputs" ${ref(this.#inputRef)} slot="a">
            <header>
              <h1>Inputs</h1>
              ${continueButton}
            </header>
            <div id="inputs-list">
              <bb-input-list
                ${ref(this.#inputListRef)}
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
          <section id="outputs" slot="b">
            <h1>Outputs</h1>
            <div id="outputs-list">
              <bb-output-list
                .messages=${this.messages}
                .messagePosition=${this.#messagePosition}
              ></bb-output-list>
            </div>
          </section>
        </bb-splitter>
        <div id="history" slot="b">
          <bb-history-tree
            .messages=${this.messages}
            .messagePosition=${this.#messagePosition}
          ></bb-history-tree>
        </div>
      </bb-splitter>
    </bb-splitter>`;
  }
}
