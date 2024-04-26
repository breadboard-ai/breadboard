/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SETTINGS_TYPE, STATUS, Settings } from "../../types/types.js";
import {
  GraphNodeSelectedEvent,
  InputEnterEvent,
  NodeDeleteEvent,
  RunEvent,
  ToastEvent,
  ToastType,
} from "../../events/events.js";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import {
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  InspectableRun,
  InspectableRunInputs,
  Kit,
  NodeIdentifier,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { JSONTree } from "../elements.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import { EditorMode } from "../../utils/mode.js";

type inputCallback = (data: Record<string, unknown>) => void;

/**
 * Breadboard UI controller element.
 *
 * @export
 * @class UI
 * @extends {LitElement}
 *
 * @property {GraphDescriptor | null} graph
 * @property {Kit[]} kits - an array of kits to use by a board
 * @property {string | null} url
 * @property {STATUS}
 * @property {Board[]}
 **/
@customElement("bb-ui-controller")
export class UI extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  @property({ reflect: true })
  status = STATUS.RUNNING;

  @property()
  run: InspectableRun | null = null;

  @property()
  inputsFromLastRun: InspectableRunInputs | null = null;

  @property({ reflect: true })
  failedToLoad = false;

  @property()
  boardId = -1;

  @property()
  settings: Settings | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

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
      this.#messagePosition = (this.run?.events?.length || 0) - 1;
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
      | PropertyValueMap<{ boardId: number; subGraphId: string | null }>
      | Map<PropertyKey, unknown>
  ): void {
    if (changedProperties.has("boardId")) {
      if (this.boardId === this.#lastBoardId) {
        return;
      }

      this.#handlers.clear();
      this.selectedNodeId = null;
    }

    if (changedProperties.has("subGraphId")) {
      this.selectedNodeId = null;
    }
  }

  protected updated(): void {
    this.#autoSwitchSidePanel = null;
  }

  render() {
    const currentNode = (): NodeIdentifier | null => {
      if (!this.run) return null;

      const currentNodeEvent = this.run.stack()[0];

      if (!currentNodeEvent) return null;

      if (this.subGraphId) return null;

      return currentNodeEvent.node.descriptor.id;
    };

    const events = this.run?.events || [];
    const eventPosition = events.length - 1;
    const nodeId = currentNode();
    const collapseNodesByDefault = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get(
          "Collapse Nodes by Default"
        )?.value
      : false;

    const hideSubboardSelectorWhenEmpty = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get(
          "Hide Embedded Board Selector When Empty"
        )?.value
      : false;

    const hideAdvancedPortsOnNodes = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get(
          "Hide Advanced Ports on Nodes"
        )?.value
      : false;

    const editorMode = hideAdvancedPortsOnNodes
      ? EditorMode.MINIMAL
      : EditorMode.ADVANCED;

    const showNodeShortcuts = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get("Show Node Shortcuts")
          ?.value
      : false;

    /**
     * Create all the elements we need.
     */
    const editor = html`<bb-editor
      .editable=${true}
      .graph=${this.graph}
      .subGraphId=${this.subGraphId}
      .kits=${this.kits}
      .loader=${this.loader}
      .highlightedNodeId=${nodeId}
      .boardId=${this.boardId}
      .collapseNodesByDefault=${collapseNodesByDefault}
      .hideSubboardSelectorWhenEmpty=${hideSubboardSelectorWhenEmpty}
      .mode=${editorMode}
      .showNodeShortcuts=${showNodeShortcuts}
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
        .disabled=${this.failedToLoad}
        .selected=${this.#autoSwitchSidePanel !== null
          ? this.#autoSwitchSidePanel
          : nothing}
      >
        <bb-activity-log
          .run=${this.run}
          .inputsFromLastRun=${this.inputsFromLastRun}
          .events=${events}
          .eventPosition=${eventPosition}
          .showExtendedInfo=${true}
          .settings=${this.settings}
          @breadboardinputrequested=${() => {
            this.#autoSwitchSidePanel = 0;
            this.requestUpdate();
          }}
          @pointerdown=${(evt: PointerEvent) => {
            if (!this.#detailsRef.value) {
              return;
            }

            const [top] = evt.composedPath();
            if (!(top instanceof HTMLElement) || !top.dataset.messageId) {
              return;
            }

            evt.stopImmediatePropagation();

            const id = top.dataset.messageId;
            const event = this.run?.getEventById(id);

            if (!event) {
              // TODO: Offer the user more information.
              console.warn(`Unable to find event with ID "${id}"`);
              return;
            }

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
            if (this.#messagePosition < events.length - 1) {
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
          .subGraphId=${this.subGraphId}
          .graph=${this.graph}
          .kits=${this.kits}
          .loader=${this.loader}
          .editable=${true}
          .providers=${this.providers}
          .providerOps=${this.providerOps}
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

    const breadcrumbs = [MAIN_BOARD_ID];
    if (this.subGraphId) {
      breadcrumbs.push(this.subGraphId);
    }

    return html`<bb-splitter
      direction=${this.isPortrait ? "vertical" : "horizontal"}
      name="layout-main"
      split="[0.75, 0.25]"
      .quickExpandCollapse=${[0.2, 0.75]}
      .showQuickExpandCollapse=${true}
    >
      <section id="diagram" slot="slot-0">
        ${this.graph === null && this.failedToLoad
          ? html`<div class="failed-to-load">
              <h1>Unable to load board</h1>
              <p>Please try again, or load a different board</p>
            </div>`
          : editor}
      </section>

      <section id="controls-activity" slot="slot-1">
        ${sidePanel}

        <div id="controls">
          <button
            id="run"
            ?disabled=${this.status !== STATUS.STOPPED || this.failedToLoad}
            @click=${() => {
              this.#autoSwitchSidePanel = 0;
              this.dispatchEvent(new RunEvent());
            }}
          >
            Run
          </button>
        </div>
      </section>
    </bb-splitter>`;
  }
}
