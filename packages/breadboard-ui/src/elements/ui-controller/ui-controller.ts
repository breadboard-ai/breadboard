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
import { Kit } from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { longTermMemory } from "../../utils/long-term-memory.js";
import { classMap } from "lit/directives/class-map.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { type InputList } from "../input/input-list/input-list.js";
import { NodeHighlightHelper } from "../../utils/highlights.js";
import { cache } from "lit/directives/cache.js";

type inputCallback = (data: Record<string, unknown>) => void;

const CONFIG_MEMORY_KEY = "ui-config";

type UIConfig = {
  showNarrowTimeline: boolean;
};

/**
 * Breadboard UI controller element.
 *
 * @export
 * @class UI
 * @extends {LitElement}
 *
 * @property {LoadArgs | null} loadInfo
 * @property {Kit[]} kits - an array of kits to use by a board
 * @property {string | null} url
 * @property {STATUS}
 * @property {Board[]}
 * @property {"mermaid" | "visualblocks" | "editor"} - the type of visualizer to use
 **/
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
  messages: HarnessRunResult[] = [];

  @state()
  config: UIConfig = {
    showNarrowTimeline: false,
  };

  @state()
  orientation: "portrait" | "landscape" = "landscape";

  #editorRenderCount = 0;
  #inputListRef: Ref<InputList> = createRef();
  #handlers: Map<string, inputCallback[]> = new Map();
  #memory = longTermMemory;
  #isUpdatingMemory = false;
  #messagePosition = 0;
  #messageDurations: Map<HarnessRunResult, number> = new Map();
  #highlightHelper = new NodeHighlightHelper();
  #resizeObserver = new ResizeObserver(() => {
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;
    if (isPortrait && this.orientation === "landscape") {
      this.orientation = "portrait";
    } else if (!isPortrait && this.orientation === "portrait") {
      this.orientation = "landscape";
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
  }

  async load(loadInfo: LoadArgs) {
    this.loadInfo = loadInfo;
  }

  /**
   * Handler method for registering input.
   *
   * Handle a specific input ID and return a promise that resolves with the data received by the handler.
   *
   * @param {string} id - Associates a specific input handler with a unique identifier.
   *
   * @returns {Promise<Record<string, unknown>>}
   */
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

  /**
   * Handler method for registering secret values.
   *
   * Asynchronously register handlers for a list of keys and
   * return a promise that resolves to an object mapping each key to its corresponding secret value.
   *
   * @param {string[]} keys - The keys for which secrets need to be
   * registered.
   *
   * @returns {Promise<Record<string, unknown>>}
   */
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

  /**
   * Handle state changes.
   *
   * Handle different types of messages and perform corresponding
   * actions based on the message type.
   *
   * @param {HarnessRunResult} message - Contains information about the state change with type and data property
   * @param {number} duration - The duration of the state change.
   *
   * @returns {Promise<Record<string, unknown> | void>}
   */
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

    const nodeId = this.#highlightHelper.currentNode(this.#messagePosition);

    /**
     * Create all the elements we need.
     */
    const editor = html`<bb-editor
      .editable=${this.url === null}
      .loadInfo=${this.loadInfo}
      .kits=${this.kits}
      .highlightedNodeId=${nodeId}
      .renderCount=${this.#editorRenderCount++}
    ></bb-editor>`;

    const timeline = html`<header>
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
      ></bb-timeline-controls>`;

    const inputs = html`<header>
        <h1>Inputs</h1>
        <button
          id="continue"
          ?disabled=${disabled}
          @click=${this.#notifyInputList}
        >
          Continue
        </button>
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
      </div>`;

    const outputs = html` <h1>Outputs</h1>
      <div id="outputs-list">
        <bb-output-list
          .messages=${this.messages}
          .messagePosition=${this.#messagePosition}
        ></bb-output-list>
      </div>`;

    const history = html`<bb-history-tree
      .messages=${this.messages}
      .messagePosition=${this.#messagePosition}
    ></bb-history-tree>`;

    /**
     * Create both layouts.
     */
    const landscapeLayout = html`<bb-splitter
      direction="horizontal"
      name="landscape-main"
      split="[0.66, 0.34]"
    >
      <bb-splitter
        direction="vertical"
        name="landscape-diagram-timeline"
        split="[0.85, 0.15]"
        slot="slot-0"
      >
        <section id="diagram" slot="slot-0">${editor}</section>
        <section id="timeline" slot="slot-1">${timeline}</section>
      </bb-splitter>

      <bb-splitter
        split="[0.33, 0.33, 0.34]"
        direction="vertical"
        name="landscape-io-history"
        slot="slot-1"
      >
        <section id="inputs" slot="slot-0">${inputs}</section>
        <section id="outputs" slot="slot-1">${outputs}</section>
        <section id="history" slot="slot-2">${history}</section>
      </bb-splitter>
    </bb-splitter>`;

    const portraitLayout = html`<bb-splitter
      direction="vertical"
      name="portrait-main"
      split="[0.4, 0.2, 0.2, 0.2]"
    >
        <section id="diagram" slot="slot-0">${editor}</section>
        <section id="timeline" slot="slot-1">${timeline}</section>
        <bb-splitter
            split="[0.5, 0.5]"
            direction="horizontal"
            name="portrait-io"
            slot="slot-2"
          >
          <section id="inputs" slot="slot-0">${inputs}</section>
          <section id="outputs" slot="slot-1">${outputs}</section>
        </bb-splitter>
        <section id="history" slot="slot-3">${history}</section>
      </bb-splitter>
    </bb-splitter>`;

    /**
     * Choose based on the window orientation.
     */
    return cache(
      this.orientation === "portrait" ? portraitLayout : landscapeLayout
    );
  }
}
