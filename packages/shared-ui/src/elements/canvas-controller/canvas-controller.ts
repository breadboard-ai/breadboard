/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("UIController");
const GlobalStrings = StringsHelper.forSection("Global");

import {
  BoardServer,
  EditHistory,
  EditableGraph,
  GraphDescriptor,
  InspectableRun,
  InspectableRunEvent,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
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
  SETTINGS_TYPE,
  STATUS,
  SettingsStore,
  TopGraphRunResult,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "../../types/types.js";
import { styles as canvasControllerStyles } from "./canvas-controller.styles.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  CommandsSetSwitchEvent,
  NodeConfigurationUpdateRequestEvent,
  StateEvent,
  ThemeEditRequestEvent,
} from "../../events/events.js";
import {
  COMMAND_SET_GRAPH_EDITOR,
  COMMAND_SET_MODULE_EDITOR,
  MAIN_BOARD_ID,
} from "../../constants/constants.js";
import { classMap } from "lit/directives/class-map.js";
import { Project, UI } from "../../state/types.js";
import "../../edit-history/edit-history-panel.js";
import "../../edit-history/edit-history-overlay.js";
import {
  createEmptyGraphSelectionState,
  createEmptyWorkspaceSelectionState,
  createWorkspaceSelectionChangeId,
} from "../../utils/workspace.js";
import { icons } from "../../styles/icons.js";
import { EntityEditor } from "../elements.js";
import { consume } from "@lit/context";
import { SharePanel } from "../share-panel/share-panel.js";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";
import { effects } from "../../styles/host/effects.js";
import { GraphTheme } from "@breadboard-ai/types";
import { createThemeStyles } from "@breadboard-ai/theme";
import { styleMap } from "lit/directives/style-map.js";
import { emptyStyles } from "../../styles/host/colors-empty.js";

const focusAppControllerWhenIn = ["canvas", "preview"];
const SIDE_ITEM_KEY = "bb-canvas-controller-side-nav-item";

import "./empty-state.js";
import { isEmpty } from "../../utils/utils.js";
import { uiStateContext } from "../../contexts/ui-state.js";
import { Signal, SignalWatcher } from "@lit-labs/signals";

@customElement("bb-canvas-controller")
export class CanvasController extends SignalWatcher(LitElement) {
  @consume({ context: uiStateContext })
  accessor #uiState!: UI;

  @property()
  accessor boardServerKits: Kit[] = [];

  @property()
  accessor boardServers: BoardServer[] = [];

  /**
   * Indicates whether or not the UI can currently run a flow or not.
   * This is useful in situations where we're doing some work on the
   * board and want to prevent the user from triggering the start
   * of the flow.
   */
  @property()
  accessor canRun = true;

  @property()
  accessor editor: EditableGraph | null = null;

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor graphIsMine = false;

  @property()
  accessor graphStore: MutableGraphStore | null = null;

  @property()
  accessor graphStoreUpdateId: number = 0;

  @property()
  accessor graphTopologyUpdateId: number = 0;

  @state()
  accessor history: EditHistory | null = null;

  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @state()
  accessor projectState: Project | null = null;

  @property()
  accessor readOnly = true;

  @property()
  accessor themeHash = 0;

  @property()
  accessor runs: InspectableRun[] | null = null;

  @property()
  accessor selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  accessor settings: SettingsStore | null = null;

  @property()
  accessor signedIn = false;

  @property({ reflect: true })
  accessor status = STATUS.RUNNING;

  @property()
  accessor topGraphResult: TopGraphRunResult | null = null;

  @property()
  accessor visualChangeId: WorkspaceVisualChangeId | null = null;

  @property({ reflect: true, type: Boolean })
  accessor showThemeDesigner = false;
  #themeOptions: AppTemplateAdditionalOptionsAvailable | null = null;

  @state()
  set sideNavItem(
    item: "activity" | "capabilities" | "edit-history" | "editor" | "app-view"
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

    if (item === "app-view") {
      this.#uiState.editorSection = "preview";
    } else if (item === "activity") {
      this.#uiState.editorSection = "console";
    }
  }
  get sideNavItem() {
    return this.#sideNavItem;
  }

  @state()
  accessor highlightState: HighlightStateWithChangeId | null = null;

  @state()
  accessor debugEvent: InspectableRunEvent | null = null;

  @state()
  accessor showAssetOrganizer = false;

  @state()
  accessor #showEditHistory = false;

  @consume({ context: googleDriveClientContext })
  @property({ attribute: false })
  accessor googleDriveClient: GoogleDriveClient | undefined;

  #sideNavItem:
    | "activity"
    | "capabilities"
    | "edit-history"
    | "editor"
    | "app-view" = "editor";
  #entityEditorRef: Ref<EntityEditor> = createRef();
  #sharePanelRef: Ref<SharePanel> = createRef();
  #lastKnownNlEditValue = "";

  static styles = [icons, effects, canvasControllerStyles];

  connectedCallback(): void {
    super.connectedCallback();

    const sideNavItem = globalThis.localStorage.getItem(SIDE_ITEM_KEY) as
      | typeof this.sideNavItem
      | null;

    if (!sideNavItem) {
      this.sideNavItem = "app-view";
    } else {
      this.sideNavItem = sideNavItem;
    }
  }

  editorRender = 0;
  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("projectState")) {
      this.#projectStateUpdated.set({});
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
    }

    let newSelectionCount = 0;
    if (this.selectionState) {
      newSelectionCount = [...this.selectionState.selectionState.graphs].reduce(
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

    // Switching away from the editor should trigger the submit so that the user
    // doesn't lose any changes.
    if (
      changedProperties.get("sideNavItem") === "editor" &&
      this.#entityEditorRef.value
    ) {
      this.#entityEditorRef.value.triggerSubmit();
    }

    // Here we decide how to handle the changing sidenav items & selections.
    // If there are no selections and we're in the editor switch out to the app
    // view. Otherwise, if there's any change to the selection and the sidenav
    // isn't set to the editor, switch to it.
    if (newSelectionCount === 0 && this.sideNavItem === "editor") {
      this.sideNavItem = "app-view";
    } else if (
      newSelectionCount > 0 &&
      changedProperties.has("selectionState") &&
      this.sideNavItem !== "editor"
    ) {
      this.sideNavItem = "editor";
    }
  }

  #projectStateUpdated = new Signal.State({});

  @signal
  get runState() {
    this.#projectStateUpdated.get();
    if (!this.projectState) {
      return new Map();
    }
    return new Map(this.projectState.run.renderer.nodes.entries());
  }

  async #deriveAppURL() {
    if (!this.graph?.url) {
      return;
    }

    for (const server of this.boardServers) {
      const graphUrl = new URL(this.graph.url);
      const capabilities = server.canProvide(graphUrl);
      if (!capabilities) {
        continue;
      }

      if (server.extendedCapabilities().preview) {
        return server.preview(graphUrl);
      }
    }

    return null;
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

    const showAssetsInGraph = true;
    const graph = this.editor?.inspect("") || null;
    const graphIsEmpty = isEmpty(graph?.raw() ?? null);

    const runState = this.runState;

    const graphEditor = guard(
      [
        graph,
        this.graphIsMine,
        this.projectState,
        runState,
        this.boardServerKits,
        this.topGraphResult,
        this.history,
        this.editorRender,
        this.selectionState,
        this.highlightState,
        this.visualChangeId,
        this.graphTopologyUpdateId,
        this.#uiState.flags,
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
          .projectState=${this.projectState}
          .runState=${runState}
          .runtimeFlags=${this.#uiState.flags}
          .graph=${graph}
          .graphIsMine=${this.graphIsMine}
          .graphTopologyUpdateId=${this.graphTopologyUpdateId}
          .graphStore=${this.graphStore}
          .state=${this.projectState?.renderer}
          .graphStoreUpdateId=${this.graphStoreUpdateId}
          .selectionState=${this.selectionState}
          .showAssetsInGraph=${showAssetsInGraph}
          .highlightState=${this.highlightState}
          .mainGraphId=${this.mainGraphId}
          .readOnly=${this.readOnly}
          .showExperimentalComponents=${showExperimentalComponents}
          .topGraphResult=${this.topGraphResult}
          @input=${(evt: Event) => {
            const composedPath = evt.composedPath();
            const isFromNLInput = composedPath.some((el) => {
              return (
                el instanceof HTMLElement &&
                el.tagName.toLocaleLowerCase() === "bb-flowgen-editor-input"
              );
            });

            if (isFromNLInput) {
              const target = composedPath.at(0);
              if (!(target instanceof HTMLTextAreaElement)) {
                return;
              }

              this.#lastKnownNlEditValue = target.value;
              this.requestUpdate();
            }
          }}
          @bbautofocuseditor=${() => {
            if (!this.#entityEditorRef.value) {
              return;
            }

            this.#entityEditorRef.value.focus();
          }}
          @bbnodeconfigurationupdaterequest=${(
            evt: NodeConfigurationUpdateRequestEvent
          ) => {
            if (!evt.id) {
              return;
            }

            this.sideNavItem = "editor";

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
              new StateEvent({
                eventType: "host.selectionstatechange",
                selectionChangeId,
                selections: newState,
                replaceExistingSelections: true,
                moveToSelection: false,
              })
            );
          }}
          @bbshowassetorganizer=${() => {
            this.showAssetOrganizer = true;
          }}
        ></bb-renderer>`;
      }
    );

    let theme: string;
    let themes: Record<string, GraphTheme>;
    let themeStyles: Record<string, string> = {};
    if (
      this.graph?.metadata?.visual?.presentation?.themes &&
      this.graph?.metadata?.visual?.presentation?.theme
    ) {
      theme = this.graph.metadata.visual.presentation.theme;
      themes = this.graph.metadata.visual.presentation.themes;

      if (themes[theme]) {
        const appPalette = themes[theme].palette;
        if (appPalette) {
          themeStyles = createThemeStyles(appPalette);
        }
      }
    }

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
        [
          graphIsEmpty,
          this.graph,
          this.topGraphResult,
          this.signedIn,
          this.selectionState,
          this.themeHash,
          selectionCount,
          this.boardServers,
          this.sideNavItem,
          this.graphTopologyUpdateId,
        ],
        () => {
          return html`<bb-app-controller
            class=${classMap({
              active: this.sideNavItem === "app-view",
            })}
            .focusWhenIn=${focusAppControllerWhenIn}
            .graph=${this.graph}
            .graphIsEmpty=${graphIsEmpty}
            .graphTopologyUpdateId=${this.graphTopologyUpdateId}
            .isMine=${this.graphIsMine}
            .projectRun=${this.projectState?.run}
            .readOnly=${!this.graphIsMine}
            .settings=${this.settings}
            .showGDrive=${this.signedIn}
            .status=${this.status}
            .themeHash=${this.themeHash}
            @bbthemeeditrequest=${(evt: ThemeEditRequestEvent) => {
              this.showThemeDesigner = true;
              this.#themeOptions = evt.themeOptions;
            }}
            @bbsharerequested=${() => {
              this.openSharePanel();
            }}
          ></bb-app-controller>`;
        }
      )}`,
      html`<bb-entity-editor
        ${ref(this.#entityEditorRef)}
        class=${classMap({
          active: this.sideNavItem === "editor",
        })}
        .graph=${graph}
        .graphTopologyUpdateId=${this.graphTopologyUpdateId}
        .graphStore=${this.graphStore}
        .graphStoreUpdateId=${this.graphStoreUpdateId}
        .selectionState=${this.selectionState}
        .mainGraphId=${this.mainGraphId}
        .readOnly=${this.readOnly}
        .projectState=${this.projectState}
      ></bb-entity-editor>`,
      html`
        <bb-console-view
          class=${classMap({
            active: this.sideNavItem === "activity",
          })}
          .run=${this.projectState?.run}
          .themeStyles=${themeStyles}
          .disclaimerContent=${this.graphIsMine
            ? GlobalStrings.from("LABEL_DISCLAIMER")
            : html`This content was created by another person. It may be
                inaccurate or unsafe.
                <a
                  target="_blank"
                  href="https://support.google.com/legal/answer/3110420?hl=en"
                  >Report legal issue</a
                >`}
        ></bb-console-view>
      `,
      html`<bb-edit-history-panel
        class=${classMap({
          active: this.sideNavItem === "edit-history",
        })}
        .history=${this.history}
      ></bb-edit-history-panel>`,
    ];

    let themeEditor: HTMLTemplateResult | symbol = nothing;
    if (this.showThemeDesigner) {
      themeEditor = html`<bb-app-theme-creator
        .graph=${this.graph}
        .themeHash=${this.themeHash}
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
        split="[0.70, 0.30]"
        @pointerdown=${() => {
          this.showThemeDesigner = false;
        }}
      >
        <div id="graph-container" slot="slot-0">
          <bb-edit-history-overlay .history=${this.history}>
          </bb-edit-history-overlay>
          ${graphIsEmpty ? this.#maybeRenderEmptyState() : nothing}
          ${graphEditor} ${themeEditor}
        </div>
        <div
          id="side-nav"
          class="side-shadow"
          slot="slot-1"
          style=${styleMap(graphIsEmpty ? emptyStyles : themeStyles)}
        >
          <div
            id="side-nav-controls"
            class=${classMap({
              "showing-preview": this.sideNavItem === "app-view",
            })}
          >
            <div id="side-nav-controls-left">
              <button
                class="sans-flex w-500 round"
                ?disabled=${this.sideNavItem === "app-view"}
                @click=${() => {
                  this.sideNavItem = "app-view";
                }}
              >
                ${Strings.from("LABEL_SECTION_PREVIEW")}
              </button>
              <button
                class="sans-flex w-500 round"
                ?disabled=${this.sideNavItem === "activity"}
                @click=${() => {
                  this.sideNavItem = "activity";
                }}
              >
                ${Strings.from("LABEL_SECTION_CONSOLE")}
              </button>
              <button
                ?disabled=${this.sideNavItem === "editor"}
                class=${classMap({
                  "sans-flex": true,
                  "w-500": true,
                  round: true,
                  invisible: selectionCount === 0,
                })}
                @click=${() => {
                  this.sideNavItem = "editor";
                }}
              >
                Step
              </button>
              <button
                class=${classMap({
                  "sans-flex": true,
                  "w-500": true,
                  round: true,
                  invisible: !this.graphIsMine,
                })}
                @click=${() => {
                  this.sideNavItem = "app-view";
                  this.showThemeDesigner = true;
                }}
              >
                Theme
              </button>
            </div>
          </div>
          <div id="side-nav-content">${sideNavItem}</div>
        </div>
      </bb-splitter>
    `;

    return [
      graph
        ? html`<section id="create-view">${contentContainer}</section>`
        : html`<section id="content" class="welcome">${graphEditor}</section>`,
      html`
        <bb-share-panel .graph=${this.graph} ${ref(this.#sharePanelRef)}>
        </bb-share-panel>
      `,
    ];
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

  #maybeRenderEmptyState() {
    if (this.#lastKnownNlEditValue !== "") {
      return nothing;
    }

    return html`<bb-empty-state></bb-empty-state>`;
  }

  openSharePanel() {
    this.#sharePanelRef?.value?.open();
  }
}
