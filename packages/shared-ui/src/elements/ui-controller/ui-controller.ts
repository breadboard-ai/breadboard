/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("UIController");

import {
  BoardServer,
  EditHistory,
  EditableGraph,
  GraphDescriptor,
  GraphLoader,
  GraphProviderCapabilities,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  RunStore,
  hash,
} from "@google-labs/breadboard";
import {
  HTMLTemplateResult,
  LitElement,
  PropertyValues,
  html,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { guard } from "lit/directives/guard.js";
import {
  AppTemplateAdditionalOptionsAvailable,
  HighlightStateWithChangeId,
  RecentBoard,
  SETTINGS_TYPE,
  STATUS,
  SettingsStore,
  TopGraphRunResult,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "../../types/types.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { ModuleEditor } from "../module-editor/module-editor.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  CommandsSetSwitchEvent,
  NodeConfigurationUpdateRequestEvent,
  ThemeEditRequestEvent,
  WorkspaceSelectionStateEvent,
} from "../../events/events.js";
import {
  COMMAND_SET_GRAPH_EDITOR,
  COMMAND_SET_MODULE_EDITOR,
  MAIN_BOARD_ID,
} from "../../constants/constants.js";
import { classMap } from "lit/directives/class-map.js";
import { Sandbox } from "@breadboard-ai/jsandbox";
import { ChatController } from "../../state/chat-controller.js";
import { Project } from "../../state/types.js";
import "../../revision-history/revision-history-panel.js";
import "../../revision-history/revision-history-overlay.js";
import {
  createEmptyGraphSelectionState,
  createEmptyWorkspaceSelectionState,
  createWorkspaceSelectionChangeId,
} from "../../utils/workspace.js";

const SIDE_ITEM_KEY = "bb-ui-controller-side-nav-item";

@customElement("bb-ui-controller")
export class UI extends LitElement {
  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @property()
  accessor editor: EditableGraph | null = null;

  @property()
  accessor runs: InspectableRun[] | null = null;

  @property()
  accessor inputsFromLastRun: InspectableRunInputs | null = null;

  @property()
  accessor boardServerKits: Kit[] = [];

  @property()
  accessor loader: GraphLoader | null = null;

  @property({ reflect: true })
  accessor status = STATUS.RUNNING;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @property()
  accessor runStore: RunStore | null = null;

  @property()
  accessor sandbox: Sandbox | null = null;

  @property()
  accessor fileSystem: FileSystem | null = null;

  @property({ reflect: true })
  accessor failedToLoad = false;

  @property()
  accessor readOnly = true;

  @property()
  accessor version = "dev";

  @property()
  accessor recentBoards: RecentBoard[] = [];

  @property()
  accessor settings: SettingsStore | null = null;

  @property()
  accessor boardServers: BoardServer[] = [];

  @property()
  accessor tabURLs: string[] = [];

  @state()
  accessor history: EditHistory | null = null;

  @property()
  accessor mode = "tree" as const;

  @property()
  set sideNavItem(
    item: "console" | "capabilities" | "revision-history" | "editor"
  ) {
    if (item === this.#sideNavItem) {
      return;
    }

    this.#sideNavItem = item;
    if (item) {
      globalThis.localStorage.setItem(SIDE_ITEM_KEY, item);
    } else {
      globalThis.localStorage.removeItem(SIDE_ITEM_KEY);
    }
  }
  get sideNavItem() {
    return this.#sideNavItem;
  }

  @property()
  accessor selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  accessor highlightState: HighlightStateWithChangeId | null = null;

  @property()
  accessor visualChangeId: WorkspaceVisualChangeId | null = null;

  @property()
  accessor graphStore: MutableGraphStore | null = null;

  @property()
  accessor graphTopologyUpdateId: number = 0;

  @property()
  accessor graphStoreUpdateId: number = 0;

  @property()
  accessor showBoardReferenceMarkers = false;

  @property()
  accessor chatController: ChatController | null = null;

  @property({ reflect: true, type: Boolean })
  accessor showThemeDesigner = false;
  #themeOptions: AppTemplateAdditionalOptionsAvailable | null = null;

  /**
   * Indicates whether or not the UI can currently run a flow or not.
   * This is useful in situations where we're doing some work on the
   * board and want to prevent the user from triggering the start
   * of the flow.
   */
  @state()
  accessor canRun = true;

  @state()
  accessor debugEvent: InspectableRunEvent | null = null;

  @state()
  accessor popoutExpanded = false;

  @state()
  accessor projectState: Project | null = null;

  @state()
  accessor signedIn = false;

  @state()
  accessor showAssetOrganizer = false;

  @state()
  accessor autoFocusEditor = false;

  @state()
  accessor outputMode: "app" | "console" = "app";

  #autoFocusEditorOnRender = false;
  #sideNavItem: "console" | "capabilities" | "revision-history" | "editor" =
    "editor";
  #moduleEditorRef: Ref<ModuleEditor> = createRef();

  static styles = uiControllerStyles;

  connectedCallback(): void {
    super.connectedCallback();

    const sideNavItem = globalThis.localStorage.getItem(SIDE_ITEM_KEY) as
      | typeof this.sideNavItem
      | null;

    if (!sideNavItem || (sideNavItem as unknown as "app-view") === "app-view") {
      this.sideNavItem = "editor";
    } else {
      this.sideNavItem = sideNavItem;
    }
  }

  editorRender = 0;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("isShowingBoardActivityOverlay")) {
      this.editorRender++;
    }

    if (changedProperties.has("selectionState")) {
      // If this is an imperative board with no selection state then set the
      // selection to be the main.
      if (
        this.selectionState?.selectionState.graphs.size === 0 &&
        this.selectionState?.selectionState.modules.size === 0 &&
        this.graph?.main
      ) {
        this.selectionState?.selectionState.modules.add(this.graph.main);
      }

      if (this.#moduleEditorRef.value) {
        if (
          !this.selectionState ||
          this.selectionState.selectionState.modules.size === 0
        ) {
          this.#moduleEditorRef.value.destroyEditor();
        }
      }
    }

    if (changedProperties.has("autoFocusEditor")) {
      this.#autoFocusEditorOnRender = true;
      this.autoFocusEditor = false;
    }
  }

  render() {
    const collapseNodesByDefault = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Collapse Nodes by Default")?.value
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

    const showSubgraphsInline = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show subgraphs inline")?.value
      : false;

    const showCustomStepEditing = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Enable Custom Step Creation")?.value
      : false;

    const showAssetsInGraph = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show Assets in Graph")?.value
      : false;

    const graph = this.editor?.inspect("") || null;
    let capabilities: false | GraphProviderCapabilities = false;
    for (const boardServer of this.boardServers) {
      if (!this.graph || !this.graph.url) {
        continue;
      }

      const canProvide = boardServer.canProvide(new URL(this.graph.url));
      if (canProvide) {
        capabilities = canProvide;
        break;
      }
    }

    const canUndo = this.history?.canUndo() ?? false;
    const canRedo = this.history?.canRedo() ?? false;
    const run = this.runs?.[0] ?? null;
    const lastRun = this.runs?.[1] ?? null;
    const events = run?.events ?? [];
    const eventPosition = events.length - 1;

    const graphEditor = guard(
      [
        graph,
        run,
        this.boardServerKits,
        this.topGraphResult,
        this.history,
        this.editorRender,
        this.mode,
        this.selectionState,
        this.highlightState,
        this.visualChangeId,
        this.graphTopologyUpdateId,
        this.showBoardReferenceMarkers,
        this.popoutExpanded,
        collapseNodesByDefault,
        hideSubboardSelectorWhenEmpty,
        showNodeShortcuts,
        showNodePreviewValues,
        invertZoomScrollDirection,
        showPortTooltips,
        highlightInvalidWires,
        showExperimentalComponents,
        showSubgraphsInline,
        showCustomStepEditing,
      ],
      () => {
        return html`<bb-renderer
          .boardServerKits=${this.boardServerKits}
          .graph=${graph}
          .graphTopologyUpdateId=${this.graphTopologyUpdateId}
          .graphStore=${this.graphStore}
          .graphStoreUpdateId=${this.graphStoreUpdateId}
          .selectionState=${this.selectionState}
          .showAssetsInGraph=${showAssetsInGraph}
          .highlightState=${this.highlightState}
          .mainGraphId=${this.mainGraphId}
          .readOnly=${this.readOnly}
          .showExperimentalComponents=${showExperimentalComponents}
          .topGraphResult=${this.topGraphResult}
          @bbnodeconfigurationupdaterequest=${(
            evt: NodeConfigurationUpdateRequestEvent
          ) => {
            if (!evt.id) {
              return;
            }

            this.sideNavItem = "editor";
            this.autoFocusEditor = true;
            const newState = createEmptyWorkspaceSelectionState();
            const graphState = createEmptyGraphSelectionState();
            const graphId = evt.subGraphId ? evt.subGraphId : MAIN_BOARD_ID;
            const selectionChangeId = createWorkspaceSelectionChangeId();
            graphState.nodes.add(evt.id);
            newState.graphs.set(graphId, graphState);

            // Intercept the port value click and convert it to a selection
            // change *and* switch the side nav item with it.
            evt.stopImmediatePropagation();

            // If the item is already selected, skip the change.
            if (
              this.selectionState?.selectionState.graphs.has(graphId) &&
              this.selectionState.selectionState.graphs
                .get(graphId)
                ?.nodes.has(evt.id)
            ) {
              return;
            }

            this.dispatchEvent(
              new WorkspaceSelectionStateEvent(
                selectionChangeId,
                newState,
                /** replaceExistingSelection */ true,
                /** animated **/ false
              )
            );
          }}
          @bbshowassetorganizer=${() => {
            this.showAssetOrganizer = true;
          }}
        ></bb-renderer>`;
      }
    );

    const selectedModules = this.selectionState?.selectionState.modules;
    const modules = selectedModules ? [...selectedModules] : [];
    if (modules.length > 0) {
      // TODO.
    }

    let moduleEditor: HTMLTemplateResult | symbol = nothing;
    if (graph && selectedModules && selectedModules.size > 0) {
      moduleEditor = html`<bb-module-editor
        ${ref(this.#moduleEditorRef)}
        .canRedo=${canRedo}
        .canUndo=${canUndo}
        .capabilities=${capabilities}
        .graph=${graph}
        .moduleId=${modules[0]}
        .modules=${graph.modules() ?? {}}
        .readOnly=${this.readOnly}
        .renderId=${crypto.randomUUID()}
        .run=${run}
        .topGraphResult=${this.topGraphResult}
        .graphStore=${this.graphStore}
      ></bb-module-editor>`;
    }

    let themeHash = 0;
    if (
      this.graph?.metadata?.visual?.presentation?.themes &&
      this.graph?.metadata?.visual?.presentation?.theme
    ) {
      const { theme, themes } = this.graph.metadata.visual.presentation;
      themeHash = hash(themes[theme]);
    }

    const hideLast = this.status === STATUS.STOPPED;
    const inputsFromLastRun = lastRun?.inputs() ?? null;
    const nextNodeId = this.topGraphResult?.currentNode?.descriptor.id ?? null;
    const graphUrl = this.graph?.url ? new URL(this.graph.url) : null;

    let selectionCount = 0;
    if (this.selectionState) {
      selectionCount = [...this.selectionState.selectionState.graphs].reduce(
        (prev, [, graph]) => {
          return (
            prev +
            graph.assets.size +
            graph.comments.size +
            graph.nodes.size +
            graph.references.size
          );
        },
        0
      );
    }
    const sideNavItem = [
      html`${guard(
        [run, events, eventPosition, this.debugEvent],
        () =>
          html` <div
            id="board-console-container"
            class=${classMap({ active: this.sideNavItem === "console" })}
          >
            <bb-board-activity
              class=${classMap({ collapsed: this.debugEvent !== null })}
              .graphUrl=${graphUrl}
              .run=${run}
              .events=${events}
              .eventPosition=${eventPosition}
              .inputsFromLastRun=${inputsFromLastRun}
              .showExtendedInfo=${true}
              .settings=${this.settings}
              .showLogTitle=${false}
              .logTitle=${"Run"}
              .hideLast=${hideLast}
              .boardServers=${this.boardServers}
              .showDebugControls=${false}
              .nextNodeId=${nextNodeId}
              @pointerdown=${(evt: PointerEvent) => {
                const [top] = evt.composedPath();
                if (!(top instanceof HTMLElement) || !top.dataset.messageId) {
                  return;
                }
                evt.stopImmediatePropagation();
                const id = top.dataset.messageId;
                const event = run?.getEventById(id);
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
              name=${Strings.from("LABEL_PROJECT")}
            ></bb-board-activity>
            ${this.debugEvent
              ? html`<bb-event-details
                  .event=${this.debugEvent}
                ></bb-event-details>`
              : nothing}
          </div>`
      )}`,
      html`${guard(
        [
          run,
          eventPosition,
          this.graph,
          this.topGraphResult,
          this.signedIn,
          this.selectionState,
          themeHash,
          selectionCount,
          this.boardServers,
        ],
        () => {
          let topGraphResult = this.topGraphResult;
          let isInSelectionState = false;
          let showingOlderResult = false;
          const mainBoardSelection =
            this.selectionState?.selectionState.graphs.get(MAIN_BOARD_ID);
          if (
            mainBoardSelection &&
            mainBoardSelection.nodes.size === 1 &&
            this.topGraphResult
          ) {
            isInSelectionState = true;
            topGraphResult = {
              currentNode: structuredClone(this.topGraphResult.currentNode),
              log: structuredClone(this.topGraphResult.log),
              status: this.topGraphResult.status,
            } as TopGraphRunResult;

            const currentItem = [...mainBoardSelection.nodes][0];
            if (currentItem) {
              // Truncate the topGraphResult log to the end of the current
              // item.
              let currentItemId: string | null = null;
              for (let i = 0; i < topGraphResult.log.length; i++) {
                const entry = topGraphResult.log[i];
                if (currentItemId !== null) {
                  if (
                    entry.type === "node" &&
                    entry.descriptor.id !== currentItem
                  ) {
                    topGraphResult.log.length = i;
                    break;
                  }

                  if (
                    entry.type === "edge" &&
                    entry.id?.startsWith(currentItemId)
                  ) {
                    // Include this edge value if it is an input.
                    topGraphResult.log.length =
                      entry.descriptor?.type === "input" ? i + 1 : i;
                    break;
                  }
                }

                if (entry.type !== "node") {
                  continue;
                }

                if (entry.descriptor.id === currentItem) {
                  currentItemId = entry.id;
                  topGraphResult.currentNode = entry;
                }
              }

              // If we are at the head of the topGraphResult just use whatever
              // its status is. If it's earlier in the run then we decide
              // based on the most recent item. If it's an open edge then we
              // consider it to be running, otherwise it is paused.
              if (topGraphResult.log.length < this.topGraphResult.log.length) {
                showingOlderResult = true;
                const newestItem = topGraphResult.log.at(-1);
                if (newestItem?.type === "edge" && newestItem.end === null) {
                  topGraphResult.status = "running";
                } else {
                  topGraphResult.status = "paused";
                }
              } else {
                if (topGraphResult.currentNode?.descriptor.id !== currentItem) {
                  // Tip of tree. Check to see if we've seen the currently
                  // selected node. If not then this is a future node and we
                  // should therefore remove the entire state.
                  topGraphResult.currentNode = null;
                  topGraphResult.log.length = 0;
                  topGraphResult.status = "paused";
                }
              }
            } else {
              console.warn(
                "Error with selection state",
                this.selectionState?.selectionState
              );
            }
          }

          return html`<bb-app-preview
            class=${classMap({
              active: this.sideNavItem === "editor" && selectionCount === 0,
            })}
            .graph=${this.graph}
            .themeHash=${themeHash}
            .run=${run}
            .eventPosition=${eventPosition}
            .topGraphResult=${topGraphResult}
            .showGDrive=${this.signedIn}
            .isInSelectionState=${isInSelectionState}
            .showingOlderResult=${showingOlderResult}
            .settings=${this.settings}
            .boardServers=${this.boardServers}
            .status=${this.status}
            @bbthemeeditrequest=${(evt: ThemeEditRequestEvent) => {
              this.showThemeDesigner = true;
              this.#themeOptions = evt.themeOptions;
            }}
          ></bb-app-preview>`;
        }
      )}`,
      html`<bb-entity-editor
        class=${classMap({
          active: this.sideNavItem === "editor" && selectionCount > 0,
        })}
        .autoFocus=${this.#autoFocusEditorOnRender}
        .graph=${graph}
        .graphTopologyUpdateId=${this.graphTopologyUpdateId}
        .graphStore=${this.graphStore}
        .graphStoreUpdateId=${this.graphStoreUpdateId}
        .selectionState=${this.selectionState}
        .mainGraphId=${this.mainGraphId}
        .readOnly=${this.readOnly}
        .projectState=${this.projectState}
      ></bb-entity-editor>`,
    ];

    let assetOrganizer: HTMLTemplateResult | symbol = nothing;
    if (this.showAssetOrganizer) {
      assetOrganizer = html`<bb-asset-organizer
        .state=${this.projectState?.organizer ?? null}
        .showGDrive=${this.signedIn}
        .showExperimentalComponents=${showExperimentalComponents}
        @bboverlaydismissed=${() => {
          this.showAssetOrganizer = false;
        }}
      ></bb-asset-organizer>`;
    }

    let themeEditor: HTMLTemplateResult | symbol = nothing;
    if (this.showThemeDesigner) {
      themeEditor = html`<bb-app-theme-creator
        .graph=${this.graph}
        .themeHash=${themeHash}
        .themeOptions=${this.#themeOptions}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
        @bboverlaydismissed=${() => {
          this.showThemeDesigner = false;
        }}
      ></bb-app-theme-creator>`;
    }

    const contentContainer = html`
      <bb-splitter
        direction=${"horizontal"}
        name="layout-main"
        split="[0.75, 0.25]"
        @pointerdown=${() => {
          this.showThemeDesigner = false;
        }}
      >
      <div id="graph-container" slot="slot-0">
        <bb-revision-history-overlay .history=${this.history}>
        </bb-revision-history-overlay>
        ${graphEditor}
        ${themeEditor}
      </div>
      <div id="side-nav" slot="slot-1">
        <div id="side-nav-content">
        ${sideNavItem}
        </div>
      </div>
      </bb-splitter> ${modules.length > 0 ? moduleEditor : nothing}
    </div>`;

    return graph
      ? html`<section id="create-view">
          ${assetOrganizer} ${contentContainer}
        </section>`
      : html`<section id="content" class="welcome">${graphEditor}</section>`;
  }

  updated() {
    // Inform bb-main which command set is in use.
    const selectedModules = this.selectionState?.selectionState.modules;
    const modules = selectedModules ? [...selectedModules] : [];

    this.dispatchEvent(
      new CommandsSetSwitchEvent(
        modules.length > 0
          ? COMMAND_SET_MODULE_EDITOR
          : COMMAND_SET_GRAPH_EDITOR
      )
    );
  }
}
