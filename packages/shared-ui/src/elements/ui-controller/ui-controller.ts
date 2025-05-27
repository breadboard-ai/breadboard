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
  ToastEvent,
  ToastType,
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
import "../../edit-history/edit-history-panel.js";
import "../../edit-history/edit-history-overlay.js";
import {
  createEmptyGraphSelectionState,
  createEmptyWorkspaceSelectionState,
  createWorkspaceSelectionChangeId,
} from "../../utils/workspace.js";
import { icons } from "../../styles/icons.js";
import { type GoogleDrivePicker, EntityEditor } from "../elements.js";
import { consume } from "@lit/context";
import {
  type SigninAdapter,
  signinAdapterContext,
} from "../../utils/signin-adapter.js";
import { findGoogleDriveAssetsInGraph } from "../google-drive/find-google-drive-assets-in-graph.js";
import { SharePanel } from "../share-panel/share-panel.js";
import { type GoogleDriveClient } from "@breadboard-ai/google-drive-kit/google-drive-client.js";
import { googleDriveClientContext } from "../../contexts/google-drive-client-context.js";

const SIDE_ITEM_KEY = "bb-ui-controller-side-nav-item";

@customElement("bb-ui-controller")
export class UI extends LitElement {
  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor graphIsMine = false;

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
  accessor #showEditHistory = false;

  @consume({ context: signinAdapterContext })
  @property({ attribute: false })
  accessor signinAdapter: SigninAdapter | undefined = undefined;

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
  #moduleEditorRef: Ref<ModuleEditor> = createRef();
  #sharePanelRef: Ref<SharePanel> = createRef();
  #googleDriveAssetAccessPickerRef: Ref<GoogleDrivePicker> = createRef();

  static styles = [icons, uiControllerStyles];

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
    if (changedProperties.has("graph")) {
      this.updateComplete.then(() => this.#checkGoogleDriveAssetsAreReadable());
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

  #renderEditHistoryButtons() {
    return html`
      <div id="edit-history-buttons">
        <button
          id="toggle-edit-history"
          aria-label=${this.#showEditHistory
            ? "Close edit history"
            : "Open edit history"}
          @click=${this.#onClickToggleEditHistory}
        >
          <span class="g-icon">history_2</span>
          Edit history
        </button>

        ${this.#showEditHistory
          ? html`
              <button
                id="close-edit-history"
                aria-label="Close edit history"
                @click=${this.#onClickCloseEditHistory}
              >
                <span class="g-icon">close</span>
              </button>
            `
          : nothing}
      </div>
    `;
  }

  #renderActivity() {
    const run = this.runs?.[0] ?? null;
    const events = run?.events ?? [];
    const eventPosition = events.length - 1;

    const hideLast = this.status === STATUS.STOPPED;
    const graphUrl = this.graph?.url ? new URL(this.graph.url) : null;
    const nextNodeId = this.topGraphResult?.currentNode?.descriptor.id ?? null;

    return html`
      <div id="board-activity-container">
        <bb-board-activity
          class=${classMap({ collapsed: this.debugEvent !== null })}
          .graphUrl=${graphUrl}
          .run=${run}
          .events=${events}
          .eventPosition=${eventPosition}
          .showExtendedInfo=${false}
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
      </div>
    `;
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
          .state=${this.projectState?.renderer}
          .graphStoreUpdateId=${this.graphStoreUpdateId}
          .selectionState=${this.selectionState}
          .showAssetsInGraph=${showAssetsInGraph}
          .highlightState=${this.highlightState}
          .mainGraphId=${this.mainGraphId}
          .readOnly=${this.readOnly}
          .showExperimentalComponents=${showExperimentalComponents}
          .topGraphResult=${this.topGraphResult}
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
          run,
          eventPosition,
          this.graph,
          this.topGraphResult,
          this.signedIn,
          this.selectionState,
          themeHash,
          selectionCount,
          this.boardServers,
          this.sideNavItem,
        ],
        () => {
          return html`<bb-app-preview
            class=${classMap({
              active: this.sideNavItem === "app-view",
            })}
            .graph=${this.graph}
            .themeHash=${themeHash}
            .run=${run}
            .eventPosition=${eventPosition}
            .topGraphResult=${this.topGraphResult}
            .showGDrive=${this.signedIn}
            .isInSelectionState=${false}
            .showingOlderResult=${false}
            .settings=${this.settings}
            .boardServers=${this.boardServers}
            .status=${this.status}
            .history=${this.history}
            .isMine=${this.graphIsMine}
            @bbthemeeditrequest=${(evt: ThemeEditRequestEvent) => {
              this.showThemeDesigner = true;
              this.#themeOptions = evt.themeOptions;
            }}
          ></bb-app-preview>`;
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
      html`<div
        id="history-activity-container"
        class=${classMap({
          active: this.sideNavItem === "activity",
        })}
      >
        ${this.#renderActivity()}
      </div>`,
      html`<bb-edit-history-panel
        class=${classMap({
          active: this.sideNavItem === "edit-history",
        })}
        .history=${this.history}
      ></bb-edit-history-panel>`,
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
        split="[0.70, 0.30]"
        @pointerdown=${() => {
          this.showThemeDesigner = false;
        }}
      >
        <div id="graph-container" slot="slot-0">
          <bb-edit-history-overlay .history=${this.history}>
          </bb-edit-history-overlay>
          ${graphEditor} ${themeEditor}
        </div>
        <div id="side-nav" slot="slot-1">
          <div id="side-nav-controls">
            <div id="side-nav-controls-left">
              <button
                ?disabled=${this.sideNavItem === "app-view"}
                @click=${() => {
                  this.sideNavItem = "app-view";
                }}
              >
                ${Strings.from("LABEL_SECTION_PREVIEW")}
              </button>
              <button
                ?disabled=${this.sideNavItem === "activity"}
                @click=${() => {
                  this.sideNavItem = "activity";
                }}
              >
                ${Strings.from("LABEL_SECTION_CONSOLE")}
              </button>
            </div>
            <div id="side-nav-controls-right">
              ${selectionCount > 0
                ? html`<button
                    ?disabled=${this.sideNavItem === "editor"}
                    @click=${() => {
                      this.sideNavItem = "editor";
                    }}
                  >
                    Editor
                  </button>`
                : nothing}
              ${this.readOnly
                ? nothing
                : html`<button
                    ?disabled=${this.sideNavItem === "edit-history"}
                    @click=${() => {
                      this.sideNavItem = "edit-history";
                    }}
                    aria-label="Edit History"
                  >
                    <span class="g-icon">history</span>
                  </button>`}

              <button id="share" @click=${this.#onClickShareButton}>URL</button>
            </div>
          </div>
          <div id="side-nav-content">${sideNavItem}</div>
        </div>
      </bb-splitter>
      ${modules.length > 0 ? moduleEditor : nothing}
    `;

    return [
      graph
        ? html`<section id="create-view">
            ${assetOrganizer} ${contentContainer}
          </section>`
        : html`<section id="content" class="welcome">${graphEditor}</section>`,
      html`
        <bb-share-panel .graph=${this.graph} ${ref(this.#sharePanelRef)}>
        </bb-share-panel>
        <bb-google-drive-picker
          ${ref(this.#googleDriveAssetAccessPickerRef)},
          mode="pick-shared-assets"
        >
        </bb-google-drive-picker>
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

  #onClickToggleEditHistory() {
    this.#showEditHistory = !this.#showEditHistory;
  }

  #onClickCloseEditHistory() {
    this.#showEditHistory = false;
  }

  #renderEditHistory() {
    return html`
      <bb-edit-history-panel
        class=${classMap({
          active: this.sideNavItem === "activity",
        })}
        .history=${this.history}
      ></bb-edit-history-panel>
    `;
  }

  async #onClickShareButton() {
    const graphUrl = this.graph?.url ? new URL(this.graph.url) : null;
    if (!graphUrl) {
      return;
    }
    if (graphUrl.protocol === "drive:") {
      this.openSharePanel();
      return;
    }

    const appUrl = await this.#deriveAppURL();
    if (!appUrl) {
      return;
    }
    await navigator.clipboard.writeText(appUrl.href);
    this.dispatchEvent(
      new ToastEvent(
        Strings.from("STATUS_COPIED_TO_CLIPBOARD"),
        ToastType.INFORMATION
      )
    );
  }

  openSharePanel() {
    this.#sharePanelRef?.value?.open();
  }

  async #checkGoogleDriveAssetsAreReadable() {
    if (!this.graph) {
      return;
    }
    const driveAssetFileIds = findGoogleDriveAssetsInGraph(this.graph);
    if (driveAssetFileIds.length === 0) {
      return;
    }
    const { googleDriveClient } = this;
    if (!googleDriveClient) {
      console.error(`No googleDriveClient was provided`);
      return;
    }
    const needsPicking: string[] = [];
    await Promise.all(
      driveAssetFileIds.map(async (fileId) => {
        const readable = await googleDriveClient.isReadable(fileId);
        if (!readable) {
          needsPicking.push(fileId);
        }
      })
    );
    if (needsPicking.length > 0) {
      const picker = this.#googleDriveAssetAccessPickerRef.value;
      if (picker) {
        picker.fileIds = needsPicking;
        picker.open();
        picker.addEventListener(
          "close",
          () => {
            picker.fileIds = [];
            window.location.reload();
          },
          { once: true }
        );
      }
    }
  }
}
