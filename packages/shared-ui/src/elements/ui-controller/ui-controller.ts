/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("UIController");
const GlobalStrings = StringsHelper.forSection("Global");

import {
  BoardServer,
  EditHistory,
  EditableGraph,
  GraphDescriptor,
  GraphLoader,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  RunStore,
  isLLMContent,
  isLLMContentArray,
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
  RecentBoard,
  SETTINGS_TYPE,
  STATUS,
  SettingsStore,
  TopGraphRunResult,
  UserInputConfiguration,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "../../types/types.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { ModuleEditor } from "../module-editor/module-editor.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  CommandsSetSwitchEvent,
  InputEnterEvent,
  RunEvent,
  StopEvent,
} from "../../events/events.js";
import {
  COMMAND_SET_GRAPH_EDITOR,
  COMMAND_SET_MODULE_EDITOR,
} from "../../constants/constants.js";
import { Editor, UserInput } from "../elements.js";
import { classMap } from "lit/directives/class-map.js";
import { Sandbox } from "@breadboard-ai/jsandbox";
import { until } from "lit/directives/until.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/behaviors.js";
import { cache, CacheDirective } from "lit/directives/cache.js";
import { DirectiveResult } from "lit/directive.js";
import { ChatController } from "../../state/chat-controller.js";
import { Organizer } from "../../state/types.js";
import { map } from "lit/directives/map.js";

const POPOUT_STATE = "bb-ui-popout-state";

@customElement("bb-ui-controller")
export class UI extends LitElement {
  @property()
  accessor mainView: "create" | "deploy" = "create";

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
  accessor readOnly = false;

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
  accessor sideNavItem: string | null = "console";

  @property()
  accessor selectionState: WorkspaceSelectionStateWithChangeId | null = null;

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
  accessor organizer: Organizer | null = null;

  @state()
  accessor signedIn = false;

  @state()
  accessor showAssetOrganizer = false;

  #lastEventPosition = 0;
  #graphEditorRef: Ref<Editor> = createRef();
  #moduleEditorRef: Ref<ModuleEditor> = createRef();
  #userInputRef: Ref<UserInput> = createRef();

  static styles = uiControllerStyles;

  connectedCallback(): void {
    super.connectedCallback();

    const popoutState = globalThis.localStorage.getItem(POPOUT_STATE);
    this.popoutExpanded = popoutState === "true";
  }

  #setPopoutState(state: boolean) {
    this.popoutExpanded = state;
    globalThis.localStorage.setItem(POPOUT_STATE, `${this.popoutExpanded}`);
  }

  editorRender = 0;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("isShowingBoardActivityOverlay")) {
      this.editorRender++;
    }

    if (changedProperties.has("status")) {
      if (
        changedProperties.get("status") === "stopped" &&
        this.status === "running"
      ) {
        this.#setPopoutState(true);
        this.sideNavItem = "console";
      }
    }

    if (changedProperties.has("topGraphResult")) {
      this.#lastEventPosition = 0;
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
  }

  #handleSideNav(label: string) {
    this.sideNavItem = label;
    this.#setPopoutState(true);
  }

  async #renderPendingInput(event: InspectableRunNodeEvent | null) {
    let userInput: HTMLTemplateResult | DirectiveResult<typeof CacheDirective> =
      cache(html`<div class="no-input-needed"></div>`);
    let continueRun: (() => void) | null = null;

    if (event !== null) {
      const { inputs, node } = event;
      const nodeSchema = await node.describe(inputs);
      const descriptor = node.descriptor;
      const schema = nodeSchema?.outputSchema || inputs.schema;
      const requiredFields = schema.required ?? [];

      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        this.dispatchEvent(
          new InputEnterEvent(descriptor.id, {}, /* allowSavingIfSecret */ true)
        );
      }

      // TODO: Implement support for multiple iterations over the
      // same input over a run. Currently, we will only grab the
      // first value.
      const values = this.inputsFromLastRun?.get(descriptor.id)?.[0];
      const userInputs: UserInputConfiguration[] = Object.entries(
        schema.properties ?? {}
      ).reduce((prev, [name, schema]) => {
        let value = values ? values[name] : undefined;
        if (schema.type === "object") {
          if (isLLMContentBehavior(schema)) {
            if (!isLLMContent(value)) {
              value = undefined;
            }
          } else {
            value = JSON.stringify(value, null, 2);
          }
        }

        if (schema.type === "array") {
          if (isLLMContentArrayBehavior(schema)) {
            if (!isLLMContentArray(value)) {
              value = undefined;
            }
          } else {
            value = JSON.stringify(value, null, 2);
          }
        }

        if (schema.type === "string" && typeof value === "object") {
          value = undefined;
        }

        prev.push({
          name,
          title: schema.title ?? name,
          secret: false,
          schema,
          configured: false,
          required: requiredFields.includes(name),
          value,
        });

        return prev;
      }, [] as UserInputConfiguration[]);

      continueRun = () => {
        if (!this.#userInputRef.value) {
          return;
        }

        const outputs = this.#userInputRef.value.processData(true);
        if (!outputs) {
          return;
        }

        this.dispatchEvent(
          new InputEnterEvent(
            descriptor.id,
            outputs,
            /* allowSavingIfSecret */ true
          )
        );
      };

      userInput = html`<bb-user-input
        .boardServers=${this.boardServers}
        .showTypes=${false}
        .showTitleInfo=${false}
        .inputs=${userInputs}
        .inlineControls=${true}
        .llmInputShowEntrySelector=${false}
        .useDebugChatInput=${true}
        ${ref(this.#userInputRef)}
        @keydown=${(evt: KeyboardEvent) => {
          const isMac = navigator.platform.indexOf("Mac") === 0;
          const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

          if (!(evt.key === "Enter" && isCtrlCommand)) {
            return;
          }

          if (!continueRun) {
            return;
          }

          continueRun();
        }}
      ></bb-user-input>`;
    }

    return html`${userInput}
      <button
        class="continue-button"
        ?disabled=${continueRun === null}
        @click=${() => {
          if (!continueRun) {
            return;
          }
          continueRun();
        }}
      >
        ${Strings.from("COMMAND_CONTINUE")}
      </button>`;
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

    const showBoardHierarchy = this.settings
      ? this.settings
          .getSection(SETTINGS_TYPE.GENERAL)
          .items.get("Show board hierarchy")?.value
      : false;

    const graph = this.editor?.inspect("") || null;
    let capabilities: false | GraphProviderCapabilities = false;
    let extendedCapabilities: false | GraphProviderExtendedCapabilities = false;
    for (const boardServer of this.boardServers) {
      if (!this.graph || !this.graph.url) {
        continue;
      }

      const canProvide = boardServer.canProvide(new URL(this.graph.url));
      if (canProvide) {
        capabilities = canProvide;
        extendedCapabilities = boardServer.extendedCapabilities();
        break;
      }
    }

    const canUndo = this.history?.canUndo() ?? false;
    const canRedo = this.history?.canRedo() ?? false;
    const run = this.runs?.[0] ?? null;
    const lastRun = this.runs?.[1] ?? null;
    const events = run?.events ?? [];
    const eventPosition = events.length - 1;

    if (this.popoutExpanded) {
      this.#lastEventPosition = this.runs?.[0]?.events.length ?? 0;
    }

    const appPreview = guard(
      [run, eventPosition, this.graph, this.topGraphResult, this.signedIn],
      () => {
        return html`<bb-app-preview
          .graph=${this.graph}
          .run=${run}
          .eventPosition=${eventPosition}
          .topGraphResult=${this.topGraphResult}
          .showGDrive=${this.signedIn}
        ></bb-app-preview>`;
      }
    );

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
        showBoardHierarchy,
      ],
      () => {
        // This needs to be kept in sync with the width of #create-view-popout.
        const offsetZoom = Math.min(window.innerWidth * 0.5, 450) - 85;

        return html`<bb-editor
          ${ref(this.#graphEditorRef)}
          .offsetZoom=${this.popoutExpanded ? offsetZoom : 0}
          .graphStoreUpdateId=${this.graphStoreUpdateId}
          .boardServerKits=${this.boardServerKits}
          .graphStore=${this.graphStore}
          .mainGraphId=${this.mainGraphId}
          .canRedo=${canRedo}
          .canUndo=${canUndo}
          .capabilities=${capabilities}
          .collapseNodesByDefault=${collapseNodesByDefault}
          .extendedCapabilities=${extendedCapabilities}
          .graph=${graph}
          .hideSubboardSelectorWhenEmpty=${hideSubboardSelectorWhenEmpty}
          .highlightInvalidWires=${highlightInvalidWires}
          .invertZoomScrollDirection=${invertZoomScrollDirection}
          .readOnly=${this.readOnly}
          .run=${run}
          .showExperimentalComponents=${showExperimentalComponents}
          .showNodePreviewValues=${showNodePreviewValues}
          .showNodeShortcuts=${showNodeShortcuts}
          .showPortTooltips=${showPortTooltips}
          .showSubgraphsInline=${this.mode === "tree"}
          .showReadOnlyOverlay=${true}
          .tabURLs=${this.tabURLs}
          .topGraphResult=${this.topGraphResult}
          .selectionState=${this.selectionState}
          .visualChangeId=${this.visualChangeId}
          .graphTopologyUpdateId=${this.graphTopologyUpdateId}
          .boardServers=${this.boardServers}
          .showBoardReferenceMarkers=${this.showBoardReferenceMarkers}
          @bbrun=${() => {
            this.#setPopoutState(true);
            this.sideNavItem = "console";
          }}
          @bbshowassetorganizer=${() => {
            this.showAssetOrganizer = true;
          }}
        ></bb-editor>`;
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
        @bbrun=${() => {
          this.#setPopoutState(true);
          this.sideNavItem = "console";
        }}
      ></bb-module-editor>`;
    }

    let chosenSideNavItem = this.sideNavItem;
    // Ensure components & capabilities only apply when the view is of the
    // correct type.
    const selectedModuleCount =
      this.selectionState?.selectionState.modules.size ?? 0;
    if (this.sideNavItem === "components" && selectedModuleCount > 0) {
      chosenSideNavItem = null;
    }

    if (this.sideNavItem === "capabilities" && selectedModuleCount === 0) {
      chosenSideNavItem = null;
    }

    const sectionNavItems = [];
    if (showBoardHierarchy) {
      sectionNavItems.unshift({
        item: "console",
        label: "LABEL_SECTION_NAV_CONSOLE",
      });
    }

    if (modules.length > 0) {
      sectionNavItems.unshift({
        item: "capabilities",
        label: "LABEL_SECTION_NAV_CAPABILITIES",
      });
    }

    if (showBoardHierarchy) {
      sectionNavItems.push({
        item: "workspace-overview",
        label: "LABEL_SECTION_NAV_PROJECT",
      });
    }

    const contentContainer = html`<div id="graph-container" slot="slot-1">
      ${graphEditor} ${modules.length > 0 ? moduleEditor : nothing}
    </div>`;

    const newestEvent = events.at(-1);

    let sideNavItem: HTMLTemplateResult | symbol = nothing;
    switch (this.sideNavItem) {
      case "workspace-overview": {
        sideNavItem = html` ${guard(
          [
            graph,
            this.mode,
            this.selectionState,
            this.graphStoreUpdateId,
            this.showBoardReferenceMarkers,
          ],
          () => {
            return html`<bb-workspace-outline
              .graph=${graph}
              .renderId=${globalThis.crypto.randomUUID()}
              .mode=${this.mode}
              .selectionState=${this.selectionState}
              .graphStoreUpdateId=${this.graphStoreUpdateId}
              .showBoardReferenceMarkers=${this.showBoardReferenceMarkers}
              @bbdragconnectorstart=${() => {
                this.showBoardReferenceMarkers = true;
              }}
            ></bb-workspace-outline>`;
          }
        )}`;
        break;
      }

      case "capabilities": {
        sideNavItem = html` <bb-capabilities-selector></bb-capabilities-selector>`;
        break;
      }

      case "console": {
        let showDebugControls = false;
        if (newestEvent && newestEvent.type === "node") {
          showDebugControls =
            this.status === "stopped" && newestEvent.end === null;
        }

        const hideLast = this.status === STATUS.STOPPED;
        const inputsFromLastRun = lastRun?.inputs() ?? null;
        const nextNodeId =
          this.topGraphResult?.currentNode?.descriptor.id ?? null;

        const graphUrl = this.graph?.url ? new URL(this.graph.url) : null;

        sideNavItem = html`${guard(
          [run, events, eventPosition, this.debugEvent],
          () =>
            html` <div id="board-console-container">
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
                .showDebugControls=${showDebugControls}
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
        )}`;
        break;
      }
    }

    const isRunning = this.topGraphResult
      ? this.topGraphResult.status === "running" ||
        this.topGraphResult.status === "paused"
      : false;

    let assetOrganizer: HTMLTemplateResult | symbol = nothing;
    if (this.showAssetOrganizer) {
      assetOrganizer = html`<bb-asset-organizer
        .state=${this.organizer}
        .showGDrive=${this.signedIn}
        @bboverlaydismissed=${() => {
          this.showAssetOrganizer = false;
        }}
      ></bb-asset-organizer>`;
    }

    return graph
      ? this.mainView === "create"
        ? html`<section id="create-view">
            ${assetOrganizer}
            <div
              id="create-view-popout"
              class=${classMap({
                expanded: this.popoutExpanded,
                wide: showBoardHierarchy === true,
              })}
            >
              <div id="create-view-popout-nav">
                <div
                  id="sections"
                  @dblclick=${() => {
                    this.#setPopoutState(!this.popoutExpanded);
                  }}
                >
                  <button
                    id="run"
                    title=${GlobalStrings.from("LABEL_RUN_PROJECT")}
                    class=${classMap({ running: isRunning })}
                    ?disabled=${this.readOnly || !this.canRun}
                    @click=${() => {
                      if (isRunning) {
                        this.dispatchEvent(new StopEvent());
                      } else {
                        this.dispatchEvent(new RunEvent());
                      }
                    }}
                  >
                    ${isRunning
                      ? GlobalStrings.from("LABEL_STOP")
                      : GlobalStrings.from("LABEL_RUN")}
                  </button>

                  ${map(sectionNavItems, ({ item, label }) => {
                    const newEventCount =
                      events.length - this.#lastEventPosition;
                    return html`<button
                      id="toggle-${item}"
                      ?disabled=${chosenSideNavItem === item &&
                      this.popoutExpanded}
                      data-count=${item === "console" &&
                      (chosenSideNavItem !== "console" ||
                        !this.popoutExpanded) &&
                      newEventCount > 0
                        ? newEventCount
                        : nothing}
                      class=${classMap({ active: chosenSideNavItem === item })}
                      @click=${() => {
                        this.#handleSideNav(item);
                      }}
                    >
                      ${Strings.from(label)}
                    </button>`;
                  })}
                  <span class="label">${Strings.from("LABEL_TEST")}</span>
                </div>

                <button
                  id="create-view-popout-toggle"
                  @click=${() => {
                    this.#setPopoutState(!this.popoutExpanded);
                  }}
                >
                  ${Strings.from("LABEL_TOGGLE_EXPAND")}
                </button>
              </div>
              ${this.debugEvent !== null
                ? html`<button
                    id="back-to-console"
                    @click=${() => {
                      this.debugEvent = null;
                    }}
                  >
                    ${Strings.from("COMMAND_BACK_TO_CONSOLE")}
                  </button>`
                : nothing}
              <div id="create-view-popout-content">${sideNavItem}</div>
              <div id="input">
                ${until(
                  this.#renderPendingInput(
                    newestEvent?.type === "node" &&
                      newestEvent.node.descriptor.type === "input"
                      ? newestEvent
                      : null
                  )
                )}
              </div>
            </div>
            ${contentContainer}
          </section>`
        : html` <section id="deploy-view">${appPreview}</section> `
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
