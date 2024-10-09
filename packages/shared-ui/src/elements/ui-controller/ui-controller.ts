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
  InspectableRunInputs,
  Kit,
  inspect,
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
import { MAIN_BOARD_ID } from "../../constants/constants.js";
import {
  RecentBoard,
  SETTINGS_TYPE,
  STATUS,
  SettingsStore,
  TopGraphRunResult,
} from "../../types/types.js";
import { styles as uiControllerStyles } from "./ui-controller.styles.js";

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

  @property()
  isShowingBoardActivityOverlay = false;

  @property()
  tabURLs: string[] = [];

  @state()
  history: EditHistory | null = null;

  static styles = uiControllerStyles;

  editorRender = 0;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("isShowingBoardActivityOverlay")) {
      this.editorRender++;
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
          .canRedo=${canRedo}
          .canUndo=${canUndo}
          .capabilities=${capabilities}
          .collapseNodesByDefault=${collapseNodesByDefault}
          .extendedCapabilities=${extendedCapabilities}
          .graph=${graph}
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
          .showReadOnlyOverlay=${true}
          .subGraphId=${this.subGraphId}
          .tabURLs=${this.tabURLs}
          .topGraphResult=${this.topGraphResult}
        ></bb-editor>`;
      }
    );

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

    return html`<section id="diagram">
      ${this.graph === null && this.failedToLoad
        ? html`<div class="failed-to-load">
            <h1>Unable to load board</h1>
            <p>Please try again, or load a different board</p>
          </div>`
        : editor}
      ${welcomePanel}
    </section>`;
  }
}
