/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SETTINGS_TYPE, STATUS, Settings } from "../../types/types.js";
import {
  GraphNodeDeselectedEvent,
  GraphNodeSelectedEvent,
  InputEnterEvent,
  MultiEditEvent,
  RunEvent,
  StopEvent,
} from "../../events/events.js";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import {
  EditHistory,
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  Kit,
  NodeIdentifier,
  RemoveNodeSpec,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import { EditorMode } from "../../utils/mode.js";
import { guard } from "lit/directives/guard.js";
import { cache } from "lit/directives/cache.js";
import { classMap } from "lit/directives/class-map.js";

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
  selectedNodeIds: string[] = [];

  @state()
  isPortrait = window.matchMedia("(orientation: portrait)").matches;

  @state()
  debugEvent: InspectableRunEvent | null = null;

  @state()
  history: EditHistory | null = null;

  #nodeSchemaUpdateCount = -1;
  #lastEdgeCount = -1;
  #lastBoardId = -1;
  #detailsRef: Ref<HTMLElement> = createRef();
  #controlsActivityRef: Ref<HTMLDivElement> = createRef();
  #handlers: Map<string, inputCallback[]> = new Map();
  #messagePosition = 0;
  #resizeObserver = new ResizeObserver(() => {
    this.isPortrait = window.matchMedia("(orientation: portrait)").matches;
  });

  static styles = uiControllerStyles;

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

  /**
   * Called when a user stops a board.
   */
  #callAllPendingInputHandlers() {
    for (const handlers of this.#handlers.values()) {
      for (const handler of handlers) {
        handler.call(null, {});
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
      this.selectedNodeIds.length = 0;
    }

    if (changedProperties.has("subGraphId")) {
      this.selectedNodeIds.length = 0;
    }
  }

  render() {
    const currentNode = (): NodeIdentifier | null => {
      if (this.status === STATUS.STOPPED) return null;

      if (!this.run) return null;

      const currentNodeEvent = this.run.stack()[0];

      if (!currentNodeEvent) return null;

      if (this.subGraphId) return null;

      return currentNodeEvent.node.descriptor.id;
    };

    let boardTitle = this.graph?.title;
    let boardVersion = this.graph?.version;
    let boardDescription = this.graph?.description;
    let boardPublished: boolean | null =
      this.graph?.metadata?.tags?.includes("published") ?? false;
    let boardIsTool: boolean | null =
      this.graph?.metadata?.tags?.includes("tool") ?? false;
    if (this.subGraphId && this.graph && this.graph.graphs) {
      const subGraph = this.graph.graphs[this.subGraphId];
      if (subGraph) {
        boardTitle = subGraph.title;
        boardVersion = subGraph.version;
        boardDescription = subGraph.description;
        boardPublished = null;
        boardIsTool = subGraph.metadata?.tags?.includes("tool") ?? false;
      }
    }

    const events = this.run?.events || [];
    const eventPosition = events.length - 1;
    const nodeId = currentNode();
    const collapseNodesByDefault = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get(
          "Collapse Nodes by Default"
        )?.value
      : false;

    const showNodeTypeDescriptions = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get(
          "Show Node Type Descriptions"
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

    const invertZoomScrollDirection = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get(
          "Invert Zoom Scroll Direction"
        )?.value
      : false;

    const editorMode = hideAdvancedPortsOnNodes
      ? EditorMode.MINIMAL
      : EditorMode.ADVANCED;

    const showNodeShortcuts = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get("Show Node Shortcuts")
          ?.value
      : false;

    const showPortTooltips = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get("Show Port Tooltips")
          ?.value
      : false;

    const highlightInvalidWires = this.settings
      ? this.settings[SETTINGS_TYPE.GENERAL].items.get(
          "Highlight Invalid Wires"
        )?.value
      : false;

    /**
     * Create all the elements we need.
     */
    const editor = guard(
      [
        this.graph,
        this.subGraphId,
        this.kits,
        nodeId,
        this.boardId,
        collapseNodesByDefault,
        hideSubboardSelectorWhenEmpty,
        editorMode,
        showNodeShortcuts,
        showNodeTypeDescriptions,
        invertZoomScrollDirection,
        showPortTooltips,
        highlightInvalidWires,
      ],
      () => {
        return html`<bb-editor
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
          .showNodeTypeDescriptions=${showNodeTypeDescriptions}
          .invertZoomScrollDirection=${invertZoomScrollDirection}
          .showPortTooltips=${showPortTooltips}
          .highlightInvalidWires=${highlightInvalidWires}
          @bbmultiedit=${(evt: MultiEditEvent) => {
            const deletedNodes: RemoveNodeSpec[] = evt.edits.filter(
              (edit) => edit.type === "removenode"
            ) as RemoveNodeSpec[];
            if (deletedNodes.length === 0) {
              return;
            }

            const selectedPrior = this.selectedNodeIds.length;
            for (const deletedNode of deletedNodes) {
              const idx = this.selectedNodeIds.indexOf(deletedNode.id);
              if (idx === -1) {
                continue;
              }

              this.selectedNodeIds.splice(idx, 1);
            }
            const selectedPost = this.selectedNodeIds.length;
            if (selectedPrior === selectedPost) {
              return;
            }

            this.selectedNodeIds = [...this.selectedNodeIds];
          }}
          @bbgraphnodeselected=${(evt: GraphNodeSelectedEvent) => {
            if (!this.selectedNodeIds) {
              this.selectedNodeIds = [];
            }

            if (!evt.id) {
              return;
            }

            const idx = this.selectedNodeIds.indexOf(evt.id);
            if (idx !== -1) {
              return;
            }

            this.selectedNodeIds = [...this.selectedNodeIds, evt.id];
            this.requestUpdate();
          }}
          @bbgraphnodedeselected=${(evt: GraphNodeDeselectedEvent) => {
            if (!this.selectedNodeIds) {
              return;
            }

            if (!evt.id) {
              return;
            }

            this.selectedNodeIds = this.selectedNodeIds.filter(
              (id) => id !== evt.id
            );
            this.requestUpdate();
          }}
          @bbgraphnodedeselectedall=${() => {
            this.selectedNodeIds = [];
            this.requestUpdate();
          }}
        ></bb-editor>`;
      }
    );

    const nodeMetaDetails = guard(
      [
        this.boardId,
        this.selectedNodeIds,
        showNodeTypeDescriptions,
        this.graph,
      ],
      () => {
        return html`<bb-node-meta-details
          .showNodeTypeDescriptions=${showNodeTypeDescriptions}
          .selectedNodeIds=${this.selectedNodeIds}
          .subGraphId=${this.subGraphId}
          .graph=${this.graph}
          .kits=${this.kits}
          .loader=${this.loader}
        ></bb-node-meta-details>`;
      }
    );

    // Track the number of edges; if it changes we need to inform the node info
    // element, and force it to re-render.
    this.#lastEdgeCount = this.graph?.edges.length || -1;
    const nodeConfiguration = guard(
      [
        this.boardId,
        this.selectedNodeIds,
        this.#lastEdgeCount,
        this.#nodeSchemaUpdateCount,
        // TODO: Figure out a cleaner way of handling this without watching for
        // all graph changes.
        this.graph,
      ],
      () => {
        return html`<bb-node-configuration
          .selectedNodeIds=${this.selectedNodeIds}
          .subGraphId=${this.subGraphId}
          .graph=${this.graph}
          .kits=${this.kits}
          .loader=${this.loader}
          .editable=${true}
          .providers=${this.providers}
          .providerOps=${this.providerOps}
          name="Selected Node"
          @bbschemachange=${() => {
            this.#nodeSchemaUpdateCount++;
          }}
          @bbgraphnodedeselectedall=${() => {
            this.selectedNodeIds = [];
            this.requestUpdate();
          }}
        ></bb-node-configuration>`;
      }
    );

    const boardDetails = guard(
      [
        this.boardId,
        this.graph,
        this.subGraphId,
        boardTitle,
        boardVersion,
        boardDescription,
        boardPublished,
        boardIsTool,
      ],
      () => {
        return html`<bb-board-details
          .boardTitle=${boardTitle}
          .boardVersion=${boardVersion}
          .boardDescription=${boardDescription}
          .boardPublished=${boardPublished}
          .boardIsTool=${boardIsTool}
          .subGraphId=${this.subGraphId}
          .active=${this.graph !== null}
        >
        </bb-board-details>`;
      }
    );

    const activityLog = guard([this.run?.events], () => {
      return html`<bb-activity-log
        .run=${this.run}
        .inputsFromLastRun=${this.inputsFromLastRun}
        .events=${events}
        .eventPosition=${eventPosition}
        .showExtendedInfo=${true}
        .settings=${this.settings}
        .logTitle=${"Activity"}
        @bbinputrequested=${() => {
          this.selectedNodeIds.length = 0;
          this.requestUpdate();
        }}
        @pointerdown=${(evt: PointerEvent) => {
          if (!this.#controlsActivityRef.value) {
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

          this.debugEvent = event;
        }}
        @bbinputenter=${(event: InputEnterEvent) => {
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
      ></bb-activity-log>`;
    });

    const entryDetails = this.debugEvent
      ? html`<div
          id="details"
          class=${classMap({ portrait: this.isPortrait })}
          ${ref(this.#detailsRef)}
          @pointerdown=${(evt: PointerEvent) => {
            evt.stopImmediatePropagation();
          }}
        >
          <bb-event-details .event=${this.debugEvent}></bb-event-details>
        </div>`
      : nothing;

    if (this.debugEvent) {
      this.addEventListener(
        "pointerdown",
        () => {
          this.debugEvent = null;
        },
        { once: true }
      );
    }

    const sidePanel = cache(
      this.selectedNodeIds.length
        ? html`${nodeMetaDetails}${nodeConfiguration}`
        : html`${boardDetails}${activityLog}`
    );

    const breadcrumbs = [MAIN_BOARD_ID];
    if (this.subGraphId) {
      breadcrumbs.push(this.subGraphId);
    }

    return html`<bb-splitter
      direction=${this.isPortrait ? "vertical" : "horizontal"}
      name="layout-main"
      split="[0.75, 0.25]"
      .showQuickExpandCollapse=${true}
    >
      <section id="diagram" slot="slot-0">
        ${this.graph === null && this.failedToLoad
          ? html`<div class="failed-to-load">
              <h1>Unable to load board</h1>
              <p>Please try again, or load a different board</p>
            </div>`
          : editor}
        ${entryDetails}
      </section>

      <section
        ${ref(this.#controlsActivityRef)}
        id="controls-activity"
        slot="slot-1"
      >
        <div id="controls-activity-content">${sidePanel}</div>

        <div id="controls">
          <button
            id="run"
            title="Run this board"
            ?disabled=${this.status !== STATUS.STOPPED ||
            this.failedToLoad ||
            !this.graph}
            @click=${() => {
              this.selectedNodeIds.length = 0;
              this.dispatchEvent(new RunEvent());
            }}
          >
            Run
          </button>
          <button
            id="stop"
            title="Stop this board"
            ?disabled=${this.status === STATUS.STOPPED ||
            this.failedToLoad ||
            !this.graph}
            @click=${() => {
              this.selectedNodeIds.length = 0;
              this.dispatchEvent(new StopEvent());
              this.#callAllPendingInputHandlers();
            }}
          >
            Stop
          </button>
        </div>
      </section>
    </bb-splitter>`;
  }
}
