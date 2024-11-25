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
} from "../../types/types.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";
import { ModuleEditor } from "../module-editor/module-editor.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  CommandsSetSwitchEvent,
  WorkspaceItemChosenEvent,
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
  subGraphId: string | null = null;

  @property()
  moduleId: string | null = null;

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

  #graphEditorRef: Ref<Editor> = createRef();
  #moduleEditorRef: Ref<ModuleEditor> = createRef();
  #workspaceItemChosen: WorkspaceItemChosenEvent | null = null;

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

    if (changedProperties.has("moduleId")) {
      if (this.moduleId === null && this.#moduleEditorRef.value) {
        this.#moduleEditorRef.value.destroyEditor();
      }

      if (this.sideNavItem === "components" && this.moduleId) {
        this.sideNavItem = null;
      }
    }

    if (changedProperties.has("mode") || changedProperties.has("subGraphId")) {
      if (this.mode === "tree") {
        this.subGraphId = null;
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
        this.subGraphId,
        this.run,
        this.kits,
        this.topGraphResult,
        this.history,
        this.editorRender,
        this.mode,
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
          .subGraphId=${this.subGraphId}
          .moduleId=${this.moduleId}
          .tabURLs=${this.tabURLs}
          .topGraphResult=${this.topGraphResult}
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

    let moduleEditor: HTMLTemplateResult | symbol = nothing;
    if (graph && this.moduleId) {
      moduleEditor = html`<bb-module-editor
        ${ref(this.#moduleEditorRef)}
        .canRedo=${canRedo}
        .canUndo=${canUndo}
        .capabilities=${capabilities}
        .graph=${graph}
        .isShowingBoardActivityOverlay=${this.isShowingBoardActivityOverlay}
        .kits=${this.kits}
        .moduleId=${this.moduleId}
        .modules=${graph.modules() ?? {}}
        .readOnly=${this.readOnly}
        .renderId=${crypto.randomUUID()}
        .run=${this.run}
        .subGraphId=${this.subGraphId}
        .topGraphResult=${this.topGraphResult}
      ></bb-module-editor>`;
    }

    const sideNavItems = ["workspace-overview"];
    if (!this.moduleId) {
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
      ${graphEditor} ${this.moduleId ? moduleEditor : nothing} ${welcomePanel}
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
                  // this.dispatchEvent(new SubGraphCreateEvent(newSubGraphName));
                }}
              >
                New item...
              </button>
            </div>
          </h1>
          ${guard(
            [graph?.raw().url, this.moduleId, this.subGraphId, this.mode],
            () =>
              html`<bb-workspace-outline
                .graph=${graph}
                .kits=${this.kits}
                .subGraphId=${this.subGraphId}
                .moduleId=${this.moduleId}
                .renderId=${globalThis.crypto.randomUUID()}
                .mode=${this.mode}
                @bbworkspaceitemchosen=${(evt: WorkspaceItemChosenEvent) => {
                  this.#workspaceItemChosen = evt;
                }}
                @bboutlinemodechange=${() => {
                  this.mode = this.mode === "list" ? "tree" : "list";
                  globalThis.localStorage.setItem(MODE_KEY, this.mode);
                }}
              ></bb-workspace-outline>`
          )}`;
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
    // Inform bb-main which command set is in use. The individual editors are
    // responsible for
    this.dispatchEvent(
      new CommandsSetSwitchEvent(
        this.moduleId ? COMMAND_SET_MODULE_EDITOR : COMMAND_SET_GRAPH_EDITOR
      )
    );

    if (this.#workspaceItemChosen) {
      const workspaceItem = this.#workspaceItemChosen;
      this.#workspaceItemChosen = null;

      if (workspaceItem.moduleId !== null) {
        return;
      }

      requestAnimationFrame(() => {
        if (!this.#graphEditorRef.value) {
          return;
        }

        this.#graphEditorRef.value.zoomToFit(0, workspaceItem.subGraphId);
        if (workspaceItem.nodeId) {
          this.#graphEditorRef.value.zoomToNode(
            workspaceItem.nodeId,
            workspaceItem.subGraphId,
            0
          );
        }
      });
    }
  }
}
