/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditHistory,
  GraphDescriptor,
  GraphLoader,
  GraphProvider,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  Kit,
  RemoveNodeSpec,
  inspect,
} from "@google-labs/breadboard";
import {
  HTMLTemplateResult,
  LitElement,
  PropertyValueMap,
  html,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { guard } from "lit/directives/guard.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import {
  GraphNodeDeselectedEvent,
  GraphNodeSelectedEvent,
  MultiEditEvent,
} from "../../events/events.js";
import {
  RecentBoard,
  SETTINGS_TYPE,
  STATUS,
  SettingsStore,
  TopGraphRunResult,
} from "../../types/types.js";
import { type NodeConfigurationInfo } from "../elements.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";

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
  run: InspectableRun | null = null;

  @property()
  inputsFromLastRun: InspectableRunInputs | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  loader: GraphLoader | null = null;

  @property({ reflect: true })
  status = STATUS.RUNNING;

  @property()
  topGraphResult: TopGraphRunResult | null = null;

  @property({ reflect: true })
  failedToLoad = false;

  @property()
  boardId = -1;

  @property()
  readOnly = false;

  @property()
  showWelcomePanel = false;

  @property()
  version = "dev";

  @property()
  recentBoards: RecentBoard[] = [];

  @property()
  settings: SettingsStore | null = null;

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

  #nodeConfigurationRef: Ref<NodeConfigurationInfo> = createRef();
  #lastBoardId = -1;
  #detailsRef: Ref<HTMLElement> = createRef();
  #controlsActivityRef: Ref<HTMLDivElement> = createRef();
  #resizeObserver = new ResizeObserver(() => {
    this.isPortrait = window.matchMedia("(orientation: portrait)").matches;
  });
  #lastEdgeCount = -1;

  static styles = uiControllerStyles;

  connectedCallback(): void {
    super.connectedCallback();
    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.unobserve(this);
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          boardId: number;
          subGraphId: string | null;
          readOnly: boolean | null;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    if (changedProperties.has("boardId")) {
      if (this.boardId === this.#lastBoardId) {
        return;
      }

      this.selectedNodeIds = [];
    }

    if (
      changedProperties.has("subGraphId") ||
      changedProperties.has("readOnly")
    ) {
      this.selectedNodeIds = [];
    }
  }

  render() {
    const collapseNodesByDefault = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Collapse Nodes by Default")?.value
      : false;

    const showNodeTypeDescriptions = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show Node Type Descriptions")?.value
      : false;

    const showNodePreviewValues = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show Node Preview Values")?.value
      : false;

    const hideSubboardSelectorWhenEmpty = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Hide Embedded Board Selector When Empty")?.value
      : false;

    const invertZoomScrollDirection = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Invert Zoom Scroll Direction")?.value
      : false;

    const showNodeShortcuts = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show Node Shortcuts")?.value
      : false;

    const showPortTooltips = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show Port Tooltips")?.value
      : false;

    const highlightInvalidWires = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Highlight Invalid Wires")?.value
      : false;

    const showExperimentalComponents = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show Experimental Components")?.value
      : false;

    const graph =
      this.graph && this.loader
        ? inspect(this.graph, {
            kits: this.kits,
            loader: this.loader,
          })
        : null;

    /**
     * Create all the elements we need.
     */
    const editor = guard(
      [
        this.graph,
        this.subGraphId,
        this.run,
        this.kits,
        this.topGraphResult,
        this.boardId,
        this.history,
        collapseNodesByDefault,
        hideSubboardSelectorWhenEmpty,
        showNodeShortcuts,
        showNodeTypeDescriptions,
        showNodePreviewValues,
        invertZoomScrollDirection,
        showPortTooltips,
        highlightInvalidWires,
        showExperimentalComponents,
      ],
      () => {
        let capabilities: false | GraphProviderCapabilities = false;
        let extendedCapabilities: false | GraphProviderExtendedCapabilities =
          false;
        for (const provider of this.providers) {
          if (!this.graph || !this.graph.url) {
            continue;
          }

          const canProvide = provider.canProvide(new URL(this.graph.url));
          if (canProvide) {
            capabilities = canProvide;
            extendedCapabilities = provider.extendedCapabilities();
            break;
          }
        }

        const canUndo = this.history?.canUndo() ?? false;
        const canRedo = this.history?.canRedo() ?? false;

        return html`<bb-editor
          .graph=${graph}
          .subGraphId=${this.subGraphId}
          .run=${this.run}
          .capabilities=${capabilities}
          .extendedCapabilities=${extendedCapabilities}
          .canUndo=${canUndo}
          .canRedo=${canRedo}
          .topGraphResult=${this.topGraphResult}
          .boardId=${this.boardId}
          .collapseNodesByDefault=${collapseNodesByDefault}
          .hideSubboardSelectorWhenEmpty=${hideSubboardSelectorWhenEmpty}
          .showNodeShortcuts=${showNodeShortcuts}
          .showNodePreviewValues=${showNodePreviewValues}
          .showNodeTypeDescriptions=${showNodeTypeDescriptions}
          .invertZoomScrollDirection=${invertZoomScrollDirection}
          .showPortTooltips=${showPortTooltips}
          .highlightInvalidWires=${highlightInvalidWires}
          .showExperimentalComponents=${showExperimentalComponents}
          .readOnly=${this.readOnly}
          .showReadOnlyOverlay=${true}
          @bbmultiedit=${(evt: MultiEditEvent) => {
            const deletedNodes: RemoveNodeSpec[] = evt.edits.filter(
              (edit) => edit.type === "removenode"
            ) as RemoveNodeSpec[];
            let graphMetadataChanges = evt.edits.filter(
              (edit) => edit.type === "changegraphmetadata"
            );
            if (
              deletedNodes.length === 0 &&
              graphMetadataChanges.length === 0
            ) {
              return;
            }

            if (graphMetadataChanges.length > 0) {
              graphMetadataChanges = graphMetadataChanges.slice(-1);
            }

            const newlySelected = this.selectedNodeIds.filter((id) => {
              if (deletedNodes.find((deleted) => deleted.id === id)) {
                return false;
              }

              const comments = graphMetadataChanges[0].metadata.comments ?? [];
              if (
                id.startsWith("comment") &&
                !comments.find((comment) => comment.id === id)
              ) {
                return false;
              }

              return true;
            });

            if (newlySelected.length === this.selectedNodeIds.length) {
              return;
            }

            this.selectedNodeIds = [...newlySelected];
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

    const events = this.run?.events || [];
    const eventPosition = events.length - 1;
    const activityLog = guard([this.run?.events], () => {
      return html`<bb-activity-log
        .run=${this.run}
        .inputsFromLastRun=${this.inputsFromLastRun}
        .events=${events}
        .eventPosition=${eventPosition}
        .showExtendedInfo=${true}
        .settings=${this.settings}
        .logTitle=${"Debug Board"}
        .waitingMessage=${'Click "Debug Board" to get started'}
        .providers=${this.providers}
        .providerOps=${this.providerOps}
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

    // If we are about to re-render and remove the node configuration element
    // we need to make sure that we are destroying all instances of the Code
    // Editor before that happens. If not, CodeMirror will retain focus and a
    // user won't be able to edit their inputs.
    //
    // If there is an "internal switch" from one node configuration view to
    // another the element will take care of destroying the editors when it
    // sees fit.
    if (this.selectedNodeIds.length === 0 && this.#nodeConfigurationRef.value) {
      this.#nodeConfigurationRef.value.destroyEditors();
      this.#nodeConfigurationRef.value.ensureRenderOnNextUpdate();
    }

    const breadcrumbs = [MAIN_BOARD_ID];
    if (this.subGraphId) {
      breadcrumbs.push(this.subGraphId);
    }

    let welcomePanel: HTMLTemplateResult | symbol = nothing;
    if (this.showWelcomePanel) {
      welcomePanel = html`<bb-welcome-panel
        .version=${this.version}
        .recentBoards=${this.recentBoards}
      ></bb-welcome-panel>`;
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
        ${entryDetails} ${welcomePanel}
      </section>

      <section
        ${ref(this.#controlsActivityRef)}
        id="controls-activity"
        slot="slot-1"
      >
        <div id="controls-activity-content">${activityLog}</div>
      </section>
    </bb-splitter>`;
  }
}
