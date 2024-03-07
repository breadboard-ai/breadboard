/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HTMLTemplateResult,
  LitElement,
  PropertyValueMap,
  html,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Board, LoadArgs, STATUS } from "../../types/types.js";
import {
  GraphNodeSelectedEvent,
  InputEnterEvent,
  RunEvent,
  ToastEvent,
  ToastType,
} from "../../events/events.js";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import { InspectableRun, Kit } from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { type InputList } from "../input/input-list/input-list.js";
import { JSONTree } from "../elements.js";

type inputCallback = (data: Record<string, unknown>) => void;

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
  inspectableRun: InspectableRun | null = null;

  @property()
  boards: Board[] = [];

  @state()
  config: UIConfig = {
    showNarrowTimeline: false,
  };

  @state()
  selectedNodeId: string | null = null;

  #autoSwitchSidePanel: number | null = null;
  #detailsRef: Ref<HTMLElement> = createRef();
  #inputListRef: Ref<InputList> = createRef();
  #handlers: Map<string, inputCallback[]> = new Map();
  #messagePosition = 0;
  #messageDurations: Map<HarnessRunResult, number> = new Map();

  static styles = uiControllerStyles;

  constructor() {
    super();

    this.addEventListener("pointerdown", () => {
      if (!this.#detailsRef.value) {
        return;
      }

      this.#detailsRef.value.classList.remove("active");
    });
  }

  clearPosition() {
    this.#messagePosition = 0;
  }

  unloadCurrentBoard() {
    this.url = null;
    this.loadInfo = null;

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
    if (this.status === STATUS.RUNNING) {
      const messages = this.inspectableRun?.messages || [];
      this.#messagePosition = messages.length - 1;
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

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ selectedNodeId: string | null }>
      | Map<PropertyKey, unknown>
  ): void {
    if (
      changedProperties.has("selectedNodeId") &&
      changedProperties.get("selectedNodeId") !== undefined &&
      changedProperties.get("selectedNodeId") !== this.selectedNodeId
    ) {
      console.log(changedProperties.get("selectedNodeId"), this.selectedNodeId);
      this.#autoSwitchSidePanel = 1;
    }
  }

  protected updated(): void {
    this.#autoSwitchSidePanel = null;
  }

  render() {
    const messages = this.inspectableRun?.messages || [];
    const newestMessage = messages[messages.length - 1];
    const nodeId =
      this.inspectableRun?.currentNode(this.#messagePosition) || "";

    const events = this.inspectableRun?.events || [];
    const eventPosition = events.length - 1;

    /**
     * Create all the elements we need.
     */
    const editor = html`<bb-editor
      .editable=${this.url === null}
      .loadInfo=${this.loadInfo}
      .kits=${this.kits}
      .highlightedNodeId=${nodeId}
      @breadboardgraphnodeselected=${(evt: GraphNodeSelectedEvent) => {
        this.selectedNodeId = evt.id;
      }}
    ></bb-editor>`;

    let currentInput: HTMLTemplateResult | symbol = nothing;
    if (newestMessage?.type === "input" || newestMessage?.type === "secret") {
      currentInput = html`<div id="inputs-list">
        <bb-input-list
          ${ref(this.#inputListRef)}
          .messages=${messages}
          .messagePosition=${this.#messagePosition}
          @breadboardinputenter=${(event: InputEnterEvent) => {
            // Notify any pending handlers that the input has arrived.
            if (this.#messagePosition < messages.length - 1) {
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
    }

    const sidePanel = html`
      <bb-switcher
        slots="3"
        .selected=${this.#autoSwitchSidePanel !== null
          ? this.#autoSwitchSidePanel
          : nothing}
      >
        <bb-activity-log
          .events=${events}
          .eventPosition=${eventPosition}
          @pointerdown=${(evt: PointerEvent) => {
            if (!this.#detailsRef.value) {
              return;
            }

            const [top] = evt.composedPath();
            if (!(top instanceof HTMLElement) || !top.dataset.messageIdx) {
              return;
            }

            const idx = Number.parseInt(top.dataset.messageIdx);
            if (Number.isNaN(idx)) {
              return;
            }

            evt.stopImmediatePropagation();

            const message = messages[idx];
            const bounds = top.getBoundingClientRect();
            const details = this.#detailsRef.value;
            details.classList.toggle("active");

            if (!details.classList.contains("active")) {
              return;
            }

            details.style.setProperty("--left", `${bounds.left}px`);
            details.style.setProperty("--top", `${bounds.top + 20}px`);

            const tree = details.querySelector("bb-json-tree") as JSONTree;
            tree.json = message.data as unknown as Record<string, string>;
            tree.autoExpand = true;
          }}
          name="Board"
          slot="slot-0"
        ></bb-activity-log>
        <bb-node-info
          .selectedNodeId=${this.selectedNodeId}
          .loadInfo=${this.loadInfo}
          .kits=${this.kits}
          .editable=${this.url === null}
          name="Selected Node"
          slot="slot-1"
        ></bb-node-info>
        <bb-history-tree
          name="History"
          slot="slot-2"
          .messages=${messages}
          .messagePosition=${this.#messagePosition}
        ></bb-history-tree>
      </bb-switcher>

      <div
        id="details"
        ${ref(this.#detailsRef)}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
      >
        <bb-json-tree></bb-json-tree>
      </div>
    `;

    return html`<bb-splitter
      direction="horizontal"
      name="landscape-main"
      split="[0.75, 0.25]"
    >
      <section id="diagram" slot="slot-0">
        <div id="breadcrumbs"></div>
        ${editor} ${currentInput}
      </section>

      <section id="controls-activity" slot="slot-1">
        <div id="controls">
          <button
            id="run"
            ?disabled=${this.status !== STATUS.STOPPED}
            @click=${() => {
              this.#autoSwitchSidePanel = 0;
              this.dispatchEvent(new RunEvent());
            }}
          >
            Run
          </button>
        </div>

        ${sidePanel}
      </section>
    </bb-splitter>`;
  }
}
