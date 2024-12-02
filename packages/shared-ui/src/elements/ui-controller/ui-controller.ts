/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  EditHistory,
  EditableGraph,
  GraphDescriptor,
  GraphLoader,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  InspectableRun,
  InspectableRunInputs,
  Kit,
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
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "../../types/types.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { ModuleEditor } from "../module-editor/module-editor.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  CommandsSetSwitchEvent,
  WorkspaceNewItemCreateRequestEvent,
} from "../../events/events.js";
import {
  COMMAND_SET_GRAPH_EDITOR,
  COMMAND_SET_MODULE_EDITOR,
} from "../../constants/constants.js";
import { Editor } from "../elements.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";

const MODE_KEY = "bb-ui-controller-outline-mode";
const SIDE_NAV_ITEM_KEY = "bb-ui-side-nav-item";

@customElement("bb-ui-controller")
export class UI extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  editor: EditableGraph | null = null;

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
  boardServers: BoardServer[] = [];

  @property()
  isShowingBoardActivityOverlay = false;

  @property()
  tabURLs: string[] = [];

  @state()
  history: EditHistory | null = null;

  @property()
  mode: "list" | "tree" = "list";

  @property()
  sideNavItem: string | null = null;

  @property()
  selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  visualChangeId: WorkspaceVisualChangeId | null = null;

  @property()
  graphTopologyUpdateId: number = 0;

  #graphEditorRef: Ref<Editor> = createRef();
  #moduleEditorRef: Ref<ModuleEditor> = createRef();

  static styles = uiControllerStyles;

  connectedCallback(): void {
    super.connectedCallback();

    const mode = globalThis.localStorage.getItem(MODE_KEY);
    if (mode === "list" || mode === "tree") {
      this.mode = mode;
    }

    const sideNavItem = globalThis.localStorage.getItem(SIDE_NAV_ITEM_KEY);
    if (sideNavItem) {
      this.sideNavItem = sideNavItem;
    }
  }

  editorRender = 0;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("isShowingBoardActivityOverlay")) {
      this.editorRender++;
    }

    if (changedProperties.has("selectionState")) {
      if (this.#moduleEditorRef.value) {
        if (
          !this.selectionState ||
          this.selectionState.selectionState.modules.size === 0
        ) {
          this.#moduleEditorRef.value.destroyEditor();
        }
      }

      const selectedModuleCount =
        this.selectionState?.selectionState.modules.size ?? 0;
      if (this.sideNavItem === "components" && selectedModuleCount > 0) {
        this.sideNavItem = null;
      }

      if (this.sideNavItem === "capabilities" && selectedModuleCount === 0) {
        this.sideNavItem = null;
      }
    }
  }

  #handleSideNav(label: string) {
    if (this.sideNavItem === label) {
      this.sideNavItem = null;
      globalThis.localStorage.removeItem(SIDE_NAV_ITEM_KEY);
    } else {
      this.sideNavItem = label;
      globalThis.localStorage.setItem(SIDE_NAV_ITEM_KEY, label);
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

    const graphEditor = guard(
      [
        graph,
        this.run,
        this.kits,
        this.topGraphResult,
        this.history,
        this.editorRender,
        this.mode,
        this.selectionState,
        this.visualChangeId,
        this.graphTopologyUpdateId,
        collapseNodesByDefault,
        hideSubboardSelectorWhenEmpty,
        showNodeShortcuts,
        showNodeTypeDescriptions,
        showNodePreviewValues,
        invertZoomScrollDirection,
        showPortTooltips,
        highlightInvalidWires,
        showExperimentalComponents,
        showSubgraphsInline,
        showBoardHierarchy,
      ],
      () => {
        return html`<bb-editor
          ${ref(this.#graphEditorRef)}
          .canRedo=${canRedo}
          .canUndo=${canUndo}
          .capabilities=${capabilities}
          .collapseNodesByDefault=${collapseNodesByDefault}
          .extendedCapabilities=${extendedCapabilities}
          .graph=${graph}
          .kits=${this.kits}
          .hideSubboardSelectorWhenEmpty=${hideSubboardSelectorWhenEmpty}
          .highlightInvalidWires=${highlightInvalidWires}
          .invertZoomScrollDirection=${invertZoomScrollDirection}
          .isShowingBoardActivityOverlay=${this.isShowingBoardActivityOverlay}
          .readOnly=${this.readOnly}
          .run=${this.run}
          .showExperimentalComponents=${showExperimentalComponents}
          .showNodePreviewValues=${showNodePreviewValues}
          .showNodeShortcuts=${showNodeShortcuts}
          .showNodeTypeDescriptions=${showNodeTypeDescriptions}
          .showPortTooltips=${showPortTooltips}
          .showSubgraphsInline=${this.mode === "tree"}
          .showReadOnlyOverlay=${true}
          .tabURLs=${this.tabURLs}
          .topGraphResult=${this.topGraphResult}
          .selectionState=${this.selectionState}
          .visualChangeId=${this.visualChangeId}
          .graphTopologyUpdateId=${this.graphTopologyUpdateId}
        ></bb-editor>`;
      }
    );

    let welcomePanel: HTMLTemplateResult | symbol = nothing;
    if (this.showWelcomePanel) {
      welcomePanel = html`<bb-welcome-panel
        .version=${this.version}
        .recentBoards=${this.recentBoards}
      ></bb-welcome-panel>`;
    }

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
        .isShowingBoardActivityOverlay=${this.isShowingBoardActivityOverlay}
        .kits=${this.kits}
        .moduleId=${modules[0]}
        .modules=${graph.modules() ?? {}}
        .readOnly=${this.readOnly}
        .renderId=${crypto.randomUUID()}
        .run=${this.run}
        .topGraphResult=${this.topGraphResult}
      ></bb-module-editor>`;
    }

    const sideNavItems = ["workspace-overview"];
    if (modules.length > 0) {
      sideNavItems.push("capabilities");
    } else {
      sideNavItems.push("components");
    }

    const sideNav = html`<div id="side-nav">
      <div id="side-nav-top">
        ${map(sideNavItems, (item) => {
          return html`<button
            id="toggle-${item}"
            class=${classMap({ active: this.sideNavItem === item })}
            @click=${() => {
              this.#handleSideNav(item);
            }}
          ></button>`;
        })}
      </div>
      <div id="side-nav-bottom"></div>
    </div> `;

    const contentContainer = html`<div id="graph-container" slot="slot-1">
      ${graphEditor} ${modules.length > 0 ? moduleEditor : nothing}
      ${welcomePanel}
    </div>`;

    let sideNavItem: HTMLTemplateResult | symbol = nothing;
    switch (this.sideNavItem) {
      case "workspace-overview": {
        sideNavItem = html`<h1 id="side-nav-title">
            <span>Workspace</span>
            <div id="workspace-controls">
              <button
                id="create-new"
                @click=${() => {
                  this.dispatchEvent(new WorkspaceNewItemCreateRequestEvent());
                }}
              >
                New item...
              </button>
            </div>
          </h1>
          ${guard(
            [graph, this.mode, this.selectionState, this.graphTopologyUpdateId],
            () => {
              return html`<bb-workspace-outline
                .graph=${graph}
                .kits=${this.kits}
                .renderId=${globalThis.crypto.randomUUID()}
                .mode=${this.mode}
                .selectionState=${this.selectionState}
                .graphTopologyUpdateId=${this.graphTopologyUpdateId}
                @bboutlinemodechange=${() => {
                  this.mode = this.mode === "list" ? "tree" : "list";
                  globalThis.localStorage.setItem(MODE_KEY, this.mode);
                }}
              ></bb-workspace-outline>`;
            }
          )}`;
        break;
      }

      case "capabilities": {
        sideNavItem = html`<h1 id="side-nav-title">Capabilities</h1>
          <bb-capabilities-selector></bb-capabilities-selector>`;
        break;
      }

      case "components": {
        sideNavItem = html`${guard(
          [graph?.kits],
          () =>
            html`<h1 id="side-nav-title">Components</h1>
              <bb-component-selector .graph=${graph}></bb-component-selector>`
        )}`;
        break;
      }
    }

    return graph
      ? html`<section id="content">
          ${sideNav}
          ${this.sideNavItem
            ? html`<bb-splitter
                id="splitter"
                split="[0.2, 0.8]"
                .name=${"outline-editor"}
                .minSegmentSizeHorizontal=${100}
              >
                <div id="outline-container" slot="slot-0">${sideNavItem}</div>
                ${contentContainer}
              </bb-splitter>`
            : contentContainer}
        </section>`
      : html`<section id="content" class="welcome">
          ${graphEditor} ${welcomePanel}
        </section>`;
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
