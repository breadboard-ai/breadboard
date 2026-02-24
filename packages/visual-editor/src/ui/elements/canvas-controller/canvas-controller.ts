/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("UIController");
const GlobalStrings = StringsHelper.forSection("Global");

import { GraphDescriptor, MainGraphIdentifier } from "@breadboard-ai/types";
import {
  HTMLTemplateResult,
  LitElement,
  PropertyValues,
  html,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { guard } from "lit/directives/guard.js";
import { AppTemplateAdditionalOptionsAvailable } from "../../types/types.js";
import { styles as canvasControllerStyles } from "./canvas-controller.styles.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  CommandsSetSwitchEvent,
  NodeConfigurationUpdateRequestEvent,
  StateEvent,
  ThemeEditRequestEvent,
} from "../../events/events.js";
import { COMMAND_SET_GRAPH_EDITOR } from "../../constants/constants.js";
import { MAIN_BOARD_ID } from "../../../sca/constants.js";
import { classMap } from "lit/directives/class-map.js";
import { AppScreenPresenter } from "../../presenters/app-screen-presenter.js";
import { RendererRunState } from "../../../sca/types.js";
import "../../edit-history/edit-history-panel.js";
import "../../edit-history/edit-history-overlay.js";
import "../../lite/step-list-view/step-list-view.js";
import "../../lite/prompt/prompt-view.js";
import {
  createEmptyGraphSelectionState,
  createEmptyMultiGraphSelectionState,
  createSelectionChangeId,
} from "../../../utils/graph-utils.js";
import { icons } from "../../styles/icons.js";
import { EntityEditor } from "../elements.js";
import { consume } from "@lit/context";
import { SharePanel } from "../share-panel/share-panel.js";

import { effects } from "../../styles/host/effects.js";
import { GraphTheme } from "@breadboard-ai/types";
import { styleMap } from "lit/directives/style-map.js";
import { emptyStyles } from "../../styles/host/colors-empty.js";

const focusAppControllerWhenIn = ["canvas", "preview"];

import "./empty-state.js";
import "../../flow-gen/flowgen-editor-input.js";
import "../../elements/graph-editing-chat/graph-editing-chat.js";

import { SignalWatcher } from "@lit-labs/signals";

import * as Theme from "../../../theme/index.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { Utils } from "../../../sca/utils.js";

@customElement("bb-canvas-controller")
export class CanvasController extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor graphTopologyUpdateId: number = 0;

  readonly #appPresenter = new AppScreenPresenter();

  // NOTE: selectionState prop removed. Entity-editor now reads from
  // SelectionController via SCA directly.

  @property({ reflect: true, type: Boolean })
  accessor showThemeDesigner = false;
  #themeOptions: AppTemplateAdditionalOptionsAvailable | null = null;

  @state()
  set sideNavItem(item: "console" | "edit-history" | "editor" | "preview") {
    if (item === this.sca.controller.editor.sidebar.section) {
      return;
    }

    this.sca.controller.editor.sidebar.section = item;
  }
  get sideNavItem() {
    return this.sca.controller.editor.sidebar.section;
  }

  @state()
  accessor showAssetOrganizer = false;

  #entityEditorRef: Ref<EntityEditor> = createRef();
  #sharePanelRef: Ref<SharePanel> = createRef();
  #lastKnownNlEditValue = "";
  #prevMainGraphId: MainGraphIdentifier | null = null;
  #prevGraph: GraphDescriptor | null = null;

  static styles = [icons, effects, canvasControllerStyles];

  override connectedCallback(): void {
    super.connectedCallback();
    this.#appPresenter.connect(this.sca);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#appPresenter.disconnect();
  }

  protected willUpdate(_changedProperties: PropertyValues<this>): void {
    // NOTE: Selection count and sidebar toggling are now handled by the
    // SCA sidebar trigger action (Sidebar.updateOnSelectionChange).

    // If the user opens an unowned graph then we default them back to the app
    // view irrespective of whatever sidenav item they had selected prior.
    const mainGraphId = this.sca.controller.editor.graph.mainGraphId;
    if (
      mainGraphId !== this.#prevMainGraphId &&
      mainGraphId &&
      this.sca.controller.editor.graph.readOnly
    ) {
      this.sideNavItem = "preview";
    }
    this.#prevMainGraphId = mainGraphId;

    // Set theme designer to hidden when navigating away
    const currentGraph = this.sca.controller.editor.graph.graph;
    if (currentGraph !== this.#prevGraph) {
      this.showThemeDesigner = false;
    }
    this.#prevGraph = currentGraph;
  }

  @signal
  get runState(): RendererRunState {
    return {
      nodes: this.sca.controller.run.renderer.nodes,
      edges: this.sca.controller.run.renderer.edges,
    };
  }

  /**
   * This is an important gubbin. It's here to provide transition between
   * signal and non-signal world. In this property, we access signal-based
   * properties that matter and then increment the count. Then, this counter
   * is used for change-detection in bb-renderer.
   */
  #runStateEffectCount = 0;
  @signal
  get #runStateEffect(): number {
    this.runState.edges.values();
    this.runState.nodes.values();
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.#appPresenter.state;
    return ++this.#runStateEffectCount;
  }

  render() {
    const gc = this.sca.controller.editor.graph;

    const graph = gc.editor?.inspect("") || null;
    // The canvas treats "loading" the same as "empty" — both show the
    // onboarding state. Only "loaded" hides the empty state.
    const graphContentState = gc.graphContentState;
    const graphIsEmpty = graphContentState !== "loaded";

    const runState = this.runState;

    const graphEditor = guard([runState, this.#runStateEffect], () => {
      return html`<bb-renderer
        .runState=${runState}
        .runStateEffect=${this.#runStateEffect}
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

          const newState = createEmptyMultiGraphSelectionState();
          const graphState = createEmptyGraphSelectionState();
          const graphId = evt.subGraphId ? evt.subGraphId : MAIN_BOARD_ID;
          const selectionChangeId = createSelectionChangeId();
          graphState.nodes.add(evt.id);
          newState.graphs.set(graphId, graphState);

          // Intercept the port value click and convert it to a selection
          // change *and* switch the side nav item with it.
          evt.stopImmediatePropagation();

          // If the item is already selected, skip the change.
          if (
            this.sca.controller.editor.selection.selection.nodes.has(evt.id)
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
    });

    let theme: string;
    let themes: Record<string, GraphTheme>;
    let themeStyles: Record<string, string> = {};
    const themeHash = this.sca.controller.editor.theme.themeHash;
    if (
      gc.graph?.metadata?.visual?.presentation?.themes &&
      gc.graph?.metadata?.visual?.presentation?.theme
    ) {
      theme = gc.graph.metadata.visual.presentation.theme;
      themes = gc.graph.metadata.visual.presentation.themes;

      if (themes[theme]) {
        const appPalette = themes[theme].palette;
        if (appPalette) {
          themeStyles = Theme.createThemeStyles(
            appPalette,
            Theme.appColorMapping
          );
        }
      }
    }

    const selectionCount = this.sca.controller.editor.selection.size;

    const sideNavItem = [
      html`${guard(
        [
          graphIsEmpty,
          gc.graph,
          this.sca.services.signinAdapter.stateSignal?.status === "signedin",
          this.sca.controller.editor.selection.selectionId,
          themeHash,
          this.#runStateEffect,
          selectionCount,
          this.sideNavItem,
          this.graphTopologyUpdateId,
          this.sca.env.flags,
        ],
        () => {
          return html`<bb-app-controller
            class=${classMap({
              active: this.sideNavItem === "preview",
            })}
            .focusWhenIn=${focusAppControllerWhenIn}
            .graph=${gc.graph}
            .graphContentState=${graphContentState}
            .graphTopologyUpdateId=${this.graphTopologyUpdateId}
            .isMine=${!gc.readOnly}
            .readOnly=${gc.readOnly}
            .runtimeFlags=${this.sca.env.flags}
            .showGDrive=${this.sca.services.signinAdapter.stateSignal
              ?.status === "signedin"}
            .status=${this.sca.controller.run.main.status}
            .themeHash=${themeHash}
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
      ></bb-entity-editor>`,
      html`
        <bb-console-view
          class=${classMap({
            active: this.sideNavItem === "console",
          })}
          .themeStyles=${themeStyles}
          .disclaimerContent=${!gc.readOnly
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
        .history=${gc.editor?.history() ?? null}
      ></bb-edit-history-panel>`,
    ];

    let themeEditor: HTMLTemplateResult | symbol = nothing;
    if (this.showThemeDesigner) {
      themeEditor = html`<bb-app-theme-creator
        .graph=${gc.graph}
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
      <ui-splitter
        name="layout-main"
        @pointerdown=${() => {
          this.showThemeDesigner = false;
        }}
      >
        <div id="graph-container" slot="s0">
          <bb-edit-history-overlay .history=${gc.editor?.history() ?? null}>
          </bb-edit-history-overlay>
          ${graphIsEmpty ? this.#maybeRenderEmptyState() : nothing}
          ${graphEditor} ${themeEditor}
        </div>
        <div
          id="side-nav"
          class="side-shadow"
          slot="s1"
          style=${styleMap(graphIsEmpty ? emptyStyles : themeStyles)}
        >
          <div
            id="side-nav-controls"
            class=${classMap({
              "showing-preview": this.sideNavItem === "preview",
            })}
          >
            <div id="side-nav-controls-left">
              <button
                class="sans-flex w-500 round"
                ?disabled=${this.sideNavItem === "preview"}
                @click=${() => {
                  this.sideNavItem = "preview";
                }}
              >
                ${Strings.from("LABEL_SECTION_PREVIEW")}
              </button>
              <button
                class=${classMap({
                  "sans-flex": true,
                  "w-500": true,
                  round: true,
                  invisible: graphIsEmpty,
                })}
                ?disabled=${this.sideNavItem === "console"}
                @click=${() => {
                  this.sideNavItem = "console";
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
                  invisible: gc.readOnly,
                })}
                @click=${() => {
                  this.sideNavItem = "preview";
                  this.showThemeDesigner = true;
                }}
              >
                Theme
              </button>
            </div>
          </div>
          <div id="side-nav-content">${sideNavItem}</div>
        </div>
      </ui-splitter>
    `;

    // On narrow screens with a loaded graph, show step-list instead of full editor
    // For empty graphs, show the empty state with flowgen input
    // When generating, switch to step-list view to show planner thoughts
    // While loading (no graph), show nothing to match non-narrow behavior
    const isGenerating =
      this.sca?.controller.global.flowgenInput.state.status === "generating";
    const showStepListView = !graphIsEmpty || isGenerating;
    const prompt =
      gc.graph?.metadata?.raw_intent ?? gc.graph?.metadata?.intent ?? null;
    const narrowScreenContent = !graph
      ? nothing
      : html`<section id="narrow-view">
          ${showStepListView
            ? html`<bb-prompt-view .prompt=${prompt}></bb-prompt-view>
                <bb-step-list-view></bb-step-list-view>`
            : html`<bb-empty-state narrow></bb-empty-state>`}
          ${gc.readOnly ||
          Utils.Helpers.isHydrating(() =>
            this.sca.env.flags.get("enableGraphEditorAgent")
          )
            ? nothing
            : this.sca.env.flags.get("enableGraphEditorAgent")
              ? html`<bb-graph-editing-chat
                  @pointerdown=${(evt: PointerEvent) => {
                    evt.stopPropagation();
                  }}
                ></bb-graph-editing-chat>`
              : html`<bb-flowgen-editor-input></bb-flowgen-editor-input>`}
        </section>`;

    const screenSize = this.sca.controller.global.screenSize.size;
    return [
      screenSize === "narrow"
        ? narrowScreenContent
        : graph
          ? html`<section id="create-view">${contentContainer}</section>`
          : html`<section id="content" class="welcome">
              ${graphEditor}
            </section>`,
      html`<bb-share-panel ${ref(this.#sharePanelRef)}></bb-share-panel>`,
    ];
  }

  updated() {
    // Inform bb-main which command set is in use.
    // Module-based command sets are no longer tracked via selectionState.
    this.dispatchEvent(new CommandsSetSwitchEvent(COMMAND_SET_GRAPH_EDITOR));
  }

  #maybeRenderEmptyState() {
    if (this.#lastKnownNlEditValue !== "") {
      return nothing;
    }

    // The empty state callouts reference the flowgen-editor-input which is not
    // rendered when the graph editing agent is active. Skip it to avoid both
    // misleading arrows and z-index overlap with the chat panel.
    if (
      !Utils.Helpers.isHydrating(() =>
        this.sca.env.flags.get("enableGraphEditorAgent")
      ) &&
      this.sca.env.flags.get("enableGraphEditorAgent")
    ) {
      return nothing;
    }

    return html`<bb-empty-state></bb-empty-state>`;
  }

  openSharePanel() {
    this.#sharePanelRef?.value?.open();
  }
}
