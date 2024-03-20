/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LoadArgs, STATUS } from "../../types/types.js";
import {
  GraphNodeSelectedEvent,
  InputEnterEvent,
  NodeDeleteEvent,
  RunEvent,
  ToastEvent,
  ToastType,
} from "../../events/events.js";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import { GraphLoader, InspectableRun, Kit } from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
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
 * @property {"mermaid" | "editor"} - the type of visualizer to use
 **/
@customElement("bb-ui-controller")
export class UI extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  @property({ reflect: true })
  status = STATUS.RUNNING;

  @property()
  run: InspectableRun | null = null;

  @property()
  boardId = -1;

  @state()
  config: UIConfig = {
    showNarrowTimeline: false,
  };

  @state()
  selectedNodeId: string | null = null;

  @state()
  isPortrait = window.matchMedia("(orientation: portrait)").matches;

  #lastBoardId = -1;
  #autoSwitchSidePanel: number | null = null;
  #detailsRef: Ref<HTMLElement> = createRef();
  #handlers: Map<string, inputCallback[]> = new Map();
  #messagePosition = 0;
  #resizeObserver = new ResizeObserver(() => {
    this.isPortrait = window.matchMedia("(orientation: portrait)").matches;
  });

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

  connectedCallback(): void {
    super.connectedCallback();
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.unobserve(this);
  }

  clearPosition() {
    this.#messagePosition = 0;
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
    message: HarnessRunResult
  ): Promise<Record<string, unknown> | void> {
    if (this.status === STATUS.RUNNING) {
      const messages = this.run?.messages || [];
      this.#messagePosition = messages.length - 1;
    }
    this.requestUpdate();

    const { data, type } = message;
    switch (type) {
      case "nodestart": {
        if (!this.#handlers.has(data.node.id)) {
          this.#handlers.set(data.node.id, []);
        }
        return;
      }

      case "nodeend": {
        this.#handlers.delete(data.node.id);
        return;
      }

      case "input": {
        return this.#registerInputHandler(data.node.id);
      }

      case "secret": {
        return this.#registerSecretsHandler(data.keys);
      }
    }
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ boardId: number }>
      | Map<PropertyKey, unknown>
  ): void {
    if (changedProperties.has("boardId")) {
      if (this.boardId === this.#lastBoardId) {
        return;
      }

      this.#handlers.clear();
    }
  }

  protected updated(): void {
    this.#autoSwitchSidePanel = null;
  }

  render() {
    const messages = this.run?.messages || [];
    const nodeId = this.run?.currentNode(this.#messagePosition) || "";

    const events = this.run?.events || [];
    const eventPosition = events.length - 1;

    /**
     * Create all the elements we need.
     */
    const editor = html`<bb-editor
      .editable=${true}
      .loadInfo=${this.loadInfo}
      .kits=${this.kits}
      .loader=${this.loader}
      .highlightedNodeId=${nodeId}
      .boardId=${this.boardId}
      @breadboardnodedelete=${(evt: NodeDeleteEvent) => {
        if (evt.id !== this.selectedNodeId) {
          return;
        }

        this.selectedNodeId = null;
      }}
      @breadboardgraphnodeselected=${(evt: GraphNodeSelectedEvent) => {
        this.selectedNodeId = evt.id;
        this.#autoSwitchSidePanel = 1;
        this.requestUpdate();
      }}
    ></bb-editor>`;

    const sidePanel = html`
      <bb-switcher
        slots="2"
        .selected=${this.#autoSwitchSidePanel !== null
          ? this.#autoSwitchSidePanel
          : nothing}
      >
        <bb-activity-log
          .loadInfo=${this.loadInfo}
          .events=${events}
          .eventPosition=${eventPosition}
          .showExtendedInfo=${true}
          .showLogDownload=${true}
          @breadboardinputrequested=${() => {
            this.#autoSwitchSidePanel = 0;
            this.requestUpdate();
          }}
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

            const event = events[idx];
            if (event.type !== "node") {
              return;
            }

            const bounds = top.getBoundingClientRect();
            const details = this.#detailsRef.value;
            details.classList.toggle("active");

            if (!details.classList.contains("active")) {
              return;
            }

            details.style.setProperty("--left", `${bounds.left}px`);
            details.style.setProperty("--top", `${bounds.top + 20}px`);

            const tree = details.querySelector("bb-json-tree") as JSONTree;
            tree.json = event as unknown as Record<string, string>;
            tree.autoExpand = true;
          }}
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
          name="Board"
          slot="slot-0"
        ></bb-activity-log>
        <bb-node-info
          .selectedNodeId=${this.selectedNodeId}
          .loadInfo=${this.loadInfo}
          .kits=${this.kits}
          .loader=${this.loader}
          .editable=${true}
          name="Selected Node"
          slot="slot-1"
        ></bb-node-info>
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
      direction=${this.isPortrait ? "vertical" : "horizontal"}
      name="layout-main"
      split="[0.75, 0.25]"
    >
      <section id="diagram" slot="slot-0">
        <div id="breadcrumbs"></div>
        ${editor}
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
