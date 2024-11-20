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
import { CommandsSetSwitchEvent } from "../../events/events.js";
import {
  COMMAND_SET_GRAPH_EDITOR,
  COMMAND_SET_MODULE_EDITOR,
} from "../../constants/constants.js";

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

  #moduleEditor: Ref<ModuleEditor> = createRef();

  static styles = uiControllerStyles;

  editorRender = 0;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("isShowingBoardActivityOverlay")) {
      this.editorRender++;
    }

    if (changedProperties.has("moduleId")) {
      if (this.moduleId === null && this.#moduleEditor.value) {
        this.#moduleEditor.value.destroyEditor();
      }
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

    /**
     * Create all the elements we need.
     */
    const graphEditor = guard(
      [
        graph,
        this.subGraphId,
        this.run,
        this.kits,
        this.topGraphResult,
        this.history,
        this.editorRender,
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
          .showSubgraphsInline=${showSubgraphsInline}
          .showReadOnlyOverlay=${true}
          .showBoardHierarchy=${showBoardHierarchy}
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
        ${ref(this.#moduleEditor)}
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

    return html`<section id="diagram">
      ${graphEditor} ${this.moduleId ? moduleEditor : nothing} ${welcomePanel}
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
  }
}
