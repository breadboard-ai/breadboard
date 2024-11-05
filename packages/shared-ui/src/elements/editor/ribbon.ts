/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  LitElement,
  html,
  css,
  PropertyValues,
  HTMLTemplateResult,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  AddSubgraphEvent,
  HideTooltipEvent,
  KitNodeChosenEvent,
  ModuleChosenEvent,
  NodeCreateEvent,
  OverflowMenuActionEvent,
  OverflowMenuSecondaryActionEvent,
  RedoEvent,
  ResetLayoutEvent,
  RunEvent,
  SaveAsEvent,
  ShowTooltipEvent,
  StopEvent,
  SubGraphChosenEvent,
  SubGraphDeleteEvent,
  ToggleBoardActivityEvent,
  ToggleFollowEvent,
  UndoEvent,
  ZoomToFitEvent,
} from "../../events/events";
import { createRandomID } from "./utils";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { InspectableGraph, SubGraphs } from "@google-labs/breadboard";
import { classMap } from "lit/directives/class-map.js";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { guard } from "lit/directives/guard.js";
import { type ComponentSelectorOverlay } from "../elements";

const COLLAPSED_MENU_BUFFER = 60;

@customElement("bb-ribbon-menu")
export class RibbonMenu extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  moduleId: string | null = null;

  @property()
  dataType = "text/plain";

  @property()
  readOnly = true;

  @property()
  canUndo = false;

  @property()
  canRedo = false;

  @property()
  follow = false;

  @property()
  isRunning = false;

  @property()
  showExperimentalComponents = false;

  @property()
  canSave = false;

  @property({ reflect: true })
  showComponentSelector = false;

  @property()
  eventCount = 0;

  @property()
  isInputPending = false;

  @property()
  isError = false;

  @property({ reflect: true })
  isShowingBoardActivityOverlay = false;

  @state()
  showSaveMenu = false;

  @state()
  showCopyMenu = false;

  @state()
  showOverflowMenu = false;

  @state()
  showSubgraphMenu = false;

  @state()
  showBoardModules = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      height: 100%;
      align-items: center;
      background: var(--bb-neutral-0);
      border-bottom: 1px solid var(--bb-neutral-300);
      padding: 0 var(--bb-grid-size-4);
      color: var(--bb-neutral-700);
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      justify-content: space-between;
    }

    #left {
      display: flex;
      height: 100%;
      align-items: center;
      flex: 1 1 auto;
      overflow-x: hidden;
      min-width: 140px;
    }

    #right {
      display: flex;
      height: 100%;
      align-items: center;
      flex: 0 0 auto;
    }

    #left > *,
    #right > * {
      flex: 0 0 auto;
      white-space: nowrap;
    }

    #component-toggle {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    #component-toggle-container,
    #components,
    #board-management,
    #edit-controls,
    #graph-controls {
      display: flex;
      height: 100%;
      align-items: center;
      flex: 0 0 auto;
    }

    #components.hidden,
    #board-management.hidden,
    #edit-controls.hidden,
    #graph-controls.hidden {
      display: none;
    }

    #components button:last-of-type {
      margin-right: 0;
    }

    bb-component-selector-overlay {
      display: none;
      position: absolute;
    }

    :host([showcomponentselector="true"]) bb-component-selector-overlay {
      display: block;
      pointer-events: auto;
    }

    #save {
      position: absolute;
      top: calc(100% + -8px);
      left: 280px;
      right: auto;
    }

    #copy {
      position: absolute;
      top: calc(100% + -8px);
      left: 320px;
      right: auto;
    }

    #subgraph-menu {
      position: absolute;
      top: calc(100% + -8px);
      left: 565px;
      right: auto;
    }

    #board-modules-menu {
      position: absolute;
      top: calc(100% + -8px);
      left: 634px;
      right: auto;
    }

    #overflow-menu {
      position: absolute;
      top: calc(100% + -8px);
      left: var(--overflow-left, 10px);
      right: auto;
    }

    .divider {
      padding: 0 var(--bb-grid-size-3) 0 0;
      margin: 0 0 0 var(--bb-grid-size-3);
      height: var(--bb-grid-size-5);
      border-left: 1px solid var(--bb-neutral-300);
    }

    #component-toggle {
      display: block;
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-ui-100);
      height: var(--bb-grid-size-7);
      padding: 0 var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size);
      transition: background 0.3s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;
    }

    #component-toggle:hover,
    #component-toggle:focus {
      transition-duration: 0.1s;
      background: var(--bb-ui-50);
    }

    #component-toggle.active {
      border: 1px solid var(--bb-ui-200);
      background: var(--bb-ui-100);
    }

    #shortcut-add-specialist,
    #shortcut-add-human,
    #shortcut-add-looper,
    #shortcut-add-comment,
    #edit-board-info,
    #shortcut-save,
    #shortcut-copy,
    #shortcut-board-modules,
    #delete-board,
    #undo,
    #redo,
    #zoom-to-fit,
    #reset-layout,
    #shortcut-overflow,
    #shortcut-add-subgraph,
    #shortcut-select-subgraph {
      width: 20px;
      height: 20px;
      background: red;
      border: none;
      border-radius: 0;
      opacity: 0.6;
      font-size: 0;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    button {
      padding: 0;
      cursor: pointer;
    }

    button[draggable="true"] {
      cursor: grab;
    }

    #left button {
      margin: 0 var(--bb-grid-size);
    }

    #right button {
      margin-left: var(--bb-grid-size-2);
    }

    #shortcut-add-specialist:hover,
    #shortcut-add-human:hover,
    #shortcut-add-looper:hover,
    #shortcut-add-comment:hover,
    #shortcut-save:hover,
    #shortcut-copy:hover,
    #shortcut-board-modules:hover,
    #delete-board:hover,
    #edit-board-info:hover,
    #undo:hover,
    #redo:hover,
    #zoom-to-fit:hover,
    #reset-layout:hover,
    #shortcut-overflow:hover,
    #shortcut-add-subgraph:hover,
    #shortcut-select-subgraph:hover,
    #shortcut-add-specialist:focus,
    #shortcut-add-human:focus,
    #shortcut-add-looper:focus,
    #shortcut-add-comment:focus,
    #shortcut-save:focus,
    #shortcut-copy:focus,
    #shortcut-board-modules:focus,
    #edit-board-info:focus,
    #delete-board:focus,
    #undo:focus,
    #redo:focus,
    #zoom-to-fit:focus,
    #reset-layout:focus,
    #shortcut-overflow:focus,
    #shortcut-add-subgraph:focus,
    #shortcut-select-subgraph:focus {
      transition-duration: 0.1s;
      opacity: 1;
    }

    #shortcut-add-specialist {
      background: var(--bb-neutral-0) var(--bb-icon-smart-toy) center center /
        20px 20px no-repeat;
    }

    #shortcut-add-human {
      background: var(--bb-neutral-0) var(--bb-icon-human) center center / 20px
        20px no-repeat;
    }

    #shortcut-add-looper {
      background: var(--bb-neutral-0) var(--bb-icon-laps) center center / 20px
        20px no-repeat;
    }

    #shortcut-add-comment {
      background: var(--bb-neutral-0) var(--bb-icon-edit) center center / 20px
        20px no-repeat;
    }

    #edit-board-info {
      background: var(--bb-neutral-0) var(--bb-icon-data-info-alert) center
        center / 20px 20px no-repeat;
    }

    #delete-board {
      background: var(--bb-neutral-0) var(--bb-icon-delete) center center / 20px
        20px no-repeat;
      margin-right: 0;
    }

    #shortcut-save {
      background: var(--bb-neutral-0);
      background-image: var(--bb-icon-save), var(--bb-icon-arrow-drop-down);
      background-position:
        0 center,
        16px center;
      background-size:
        20px 20px,
        20px 20px;
      background-repeat: no-repeat, no-repeat;
      margin-right: var(--bb-grid-size);
    }

    #shortcut-save.show-more {
      width: var(--bb-grid-size-9);
    }

    #shortcut-copy {
      width: var(--bb-grid-size-9);
      background: var(--bb-neutral-0);
      background-image: var(--bb-icon-copy-to-clipboard),
        var(--bb-icon-arrow-drop-down);
      background-position:
        0 center,
        16px center;
      background-size:
        20px 20px,
        20px 20px;
      background-repeat: no-repeat, no-repeat;
      margin-right: var(--bb-grid-size);
    }

    #shortcut-board-modules {
      width: var(--bb-grid-size-9);
      background: var(--bb-neutral-0);
      background-image: var(--bb-icon-extension), var(--bb-icon-arrow-drop-down);
      background-position:
        0 center,
        16px center;
      background-size:
        20px 20px,
        20px 20px;
      background-repeat: no-repeat, no-repeat;
      margin-right: var(--bb-grid-size);
    }

    #undo {
      background: var(--bb-neutral-0) var(--bb-icon-undo) center center / 20px
        20px no-repeat;
    }

    #redo {
      background: var(--bb-neutral-0) var(--bb-icon-redo) center center / 20px
        20px no-repeat;
    }

    #left button#redo {
      margin-right: 0;
    }

    #redo[disabled],
    #undo[disabled] {
      opacity: 0.4;
      cursor: auto;
    }

    #zoom-to-fit {
      background: var(--bb-neutral-0) var(--bb-icon-fit) center center / 20px
        20px no-repeat;
    }

    #reset-layout {
      background: var(--bb-neutral-0) var(--bb-icon-reset-nodes) center center /
        20px 20px no-repeat;
    }

    #shortcut-overflow {
      background: var(--bb-neutral-0) var(--bb-icon-more-vert) center center /
        20px 20px no-repeat;
      display: none;
    }

    #shortcut-add-subgraph {
      background: var(--bb-neutral-0) var(--bb-icon-add-circle) center center /
        20px 20px no-repeat;
    }

    #shortcut-select-subgraph {
      width: var(--bb-grid-size-9);
      background: var(--bb-neutral-0);
      background-image: var(--bb-icon-board), var(--bb-icon-arrow-drop-down);
      background-position:
        0 center,
        16px center;
      background-size:
        20px 20px,
        20px 20px;
      background-repeat: no-repeat, no-repeat;
      margin-right: var(--bb-grid-size);
    }

    #shortcut-overflow.visible {
      display: block;
    }

    .hidden {
      display: none;
    }

    #run {
      width: 116px;
      height: var(--bb-grid-size-7);
      background: var(--bb-ui-600) var(--bb-icon-play-filled-inverted) 8px
        center / 20px 20px no-repeat;
      color: #fff;
      border-radius: 20px;
      border: none;
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-7);
      cursor: pointer;
    }

    #run.running {
      background: var(--bb-ui-600) url(/images/progress-ui-inverted.svg) 8px
        center / 16px 16px no-repeat;
    }

    #follow {
      border-radius: var(--bb-grid-size);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      padding: 0;
      height: var(--bb-grid-size-7);
      cursor: pointer;
      border: 1px solid var(--bb-neutral-300);
      transition: all 0.3s cubic-bezier(0, 0, 0.3, 1);
      font-size: 0;
      width: var(--bb-grid-size-7);
      background: var(--bb-neutral-0) var(--bb-icon-directions) center center /
        20px 20px no-repeat;
    }

    #follow:focus,
    #follow:hover {
      color: var(--bb-inputs-600);
      background: var(--bb-neutral-0) var(--bb-icon-directions-active) center
        center / 20px 20px no-repeat;
      border: 1px solid var(--bb-inputs-300);
    }

    #follow.active {
      opacity: 1;
      color: var(--bb-inputs-700);
      background: var(--bb-inputs-50) var(--bb-icon-directions-active) center
        center / 20px 20px no-repeat;
      border: 1px solid var(--bb-inputs-500);
    }

    #board-activity {
      display: flex;
      align-items: center;
      border: 1px solid var(--bb-neutral-300);
      height: var(--bb-grid-size-7);
      padding: 0 var(--bb-grid-size) 0 var(--bb-grid-size-8);
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      background: var(--bb-neutral-0) var(--bb-icon-vital-signs) 6px center /
        20px 20px no-repeat;
      border-radius: var(--bb-grid-size);
    }

    #board-activity span {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--bb-neutral-0);
      background: var(--bb-neutral-600);
      border-radius: var(--bb-grid-size);
      height: 20px;
      width: 20px;
    }

    #board-activity span.pending {
      background: var(--bb-inputs-500);
      color: var(--bb-neutral-0);
    }

    #board-activity span.error {
      background: var(--bb-warning-600);
      color: var(--bb-neutral-0);
    }

    @media (min-width: 500px) {
      #board-activity::before {
        content: "Board Activity";
        padding-right: var(--bb-grid-size-2);
      }
    }

    :host([isshowingboardactivityoverlay="true"]) #board-activity {
      border: 1px solid var(--bb-ui-300);
      background: var(--bb-ui-50) var(--bb-icon-vital-signs) 6px center / 20px
        20px no-repeat;
    }
  `;

  #overflowActions: Array<{
    title: string;
    name: string;
    icon: string;
    disabled?: boolean;
  }> = [];
  #boardActivityRef: Ref<HTMLButtonElement> = createRef();
  #overflowMenuToggleRef: Ref<HTMLButtonElement> = createRef();
  #componentSelectorRef: Ref<ComponentSelectorOverlay> = createRef();
  #segmentThresholds = new WeakMap<Element, { left: number; right: number }>();
  #animateComponentSelector = false;
  #resizeObserver = new ResizeObserver((entries) => {
    if (entries.length === 0) {
      return;
    }

    const target = entries[0].target;
    if (!target.shadowRoot) {
      return;
    }

    const left = target.shadowRoot.querySelector("#left");
    if (!left) {
      return;
    }

    const leftBounds = left.getBoundingClientRect();
    const menuSegments = left.children;
    this.#overflowActions.length = 0;
    let overflowLeft = Number.POSITIVE_INFINITY;

    // Ensure all thresholds are in place first
    for (const segment of menuSegments) {
      if (
        segment.id === "shortcut-overflow" ||
        segment.id === "component-toggle-container"
      ) {
        continue;
      }

      if (!this.#segmentThresholds.get(segment)) {
        const { left, right } = segment.getBoundingClientRect();
        this.#segmentThresholds.set(segment, { left, right });
      }
    }

    for (const segment of menuSegments) {
      const threshold = this.#segmentThresholds.get(segment);
      if (threshold === undefined) {
        continue;
      }

      const hidden = threshold.right + COLLAPSED_MENU_BUFFER > leftBounds.right;
      segment.classList.toggle("hidden", hidden);
      if (hidden) {
        overflowLeft = Math.min(threshold.left, overflowLeft);

        switch (segment.id) {
          case "board-management": {
            this.#overflowActions.push(
              {
                title: "Edit board information",
                name: "edit-board-details",
                icon: "edit-board-details",
              },
              {
                title: "Save",
                name: "save",
                icon: "save",
              },
              {
                title: "Save As...",
                name: "save-as",
                icon: "save-as",
              },
              {
                title: "Copy Board Contents",
                name: "copy-board-contents",
                icon: "copy",
              },
              {
                title: "Copy Board URL",
                name: "copy-to-clipboard",
                icon: "copy",
              },
              {
                title: "Copy Tab URL",
                name: "copy-tab-to-clipboard",
                icon: "copy",
              },
              {
                title: "Copy Preview URL",
                name: "copy-preview-to-clipboard",
                icon: "copy",
              },
              {
                title: "Delete this board",
                name: "delete",
                icon: "delete",
              }
            );
            break;
          }

          case "edit-controls": {
            this.#overflowActions.push(
              {
                title: "Undo",
                name: "undo",
                icon: "undo",
              },
              {
                title: "Redo",
                name: "redo",
                icon: "redo",
              }
            );
            break;
          }

          case "graph-controls": {
            this.#overflowActions.push(
              {
                title: "Zoom board to fit",
                name: "zoom-board-to-fit",
                icon: "zoom-to-fit",
              },
              {
                title: "Reset board layout",
                name: "reset-board-layout",
                icon: "reset-nodes",
              },
              {
                title: "Add sub board",
                name: "add-sub-graph",
                icon: "add-circle",
              }
            );
            break;
          }
        }
      }
    }

    if (overflowLeft < Number.POSITIVE_INFINITY) {
      this.style.setProperty("--overflow-left", `${overflowLeft}px`);
    }

    if (!this.#overflowMenuToggleRef.value) {
      return;
    }

    this.#overflowMenuToggleRef.value.classList.toggle(
      "visible",
      this.#overflowActions.length > 0
    );
  });

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    // If the graph has changed and:
    //  - 1. showComponentSelector is true, do not animate
    //  - 2. showComponentSelector is false, animate
    if (changedProperties.has("graph")) {
      this.#animateComponentSelector = !this.showComponentSelector;
    } else if (changedProperties.has("showComponentSelector")) {
      // If the user has toggled the component selector, animate.
      this.#animateComponentSelector = true;
    }

    if (this.#componentSelectorRef.value) {
      // Because there is a guard preventing re-rendering of the component
      // selector unless the current graph changes, we directly update its
      // static property here.
      this.#componentSelectorRef.value.static = !this.#animateComponentSelector;
    }
  }

  protected firstUpdated(): void {
    this.#resizeObserver.observe(this);
  }

  protected updated(changedProperties: PropertyValues): void {
    if (!changedProperties.has("showComponentSelector")) {
      return;
    }

    if (!this.#componentSelectorRef.value) {
      return;
    }

    this.#componentSelectorRef.value.selectSearchInput();
  }

  #showBoardActivity(forceOn = false) {
    if (!this.#boardActivityRef.value) {
      return;
    }

    const bounds = this.#boardActivityRef.value.getBoundingClientRect();
    this.dispatchEvent(
      new ToggleBoardActivityEvent(
        bounds.left + bounds.width / 2,
        bounds.bottom + 14,
        forceOn
      )
    );
  }

  render() {
    const componentSelector: HTMLTemplateResult = html`${guard(
      [this.graph?.raw().url],
      () => {
        return html`<bb-component-selector-overlay
          .graph=${this.graph}
          .showExperimentalComponents=${this.showExperimentalComponents}
          .static=${!this.#animateComponentSelector}
          ${ref(this.#componentSelectorRef)}
          @bbkitnodechosen=${(evt: KitNodeChosenEvent) => {
            const id = createRandomID(evt.nodeType);
            this.dispatchEvent(new NodeCreateEvent(id, evt.nodeType));
          }}
          @bboverlaydismissed=${() => {
            if (!this.#componentSelectorRef.value) {
              return;
            }

            if (this.#componentSelectorRef.value.persist) {
              return;
            }

            this.showComponentSelector = false;
          }}
        ></bb-component-selector-overlay>`;
      }
    )}`;

    const components = html`
      <div id="component-toggle-container">
        <button
          id="component-toggle"
          class=${classMap({ active: this.showComponentSelector })}
          @click=${() => {
            this.showComponentSelector = !this.showComponentSelector;
          }}
        >
          Components
        </button>
      </div>
      <div id="components">
        <button
          draggable="true"
          id="shortcut-add-specialist"
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Add Specialist Component",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @dblclick=${() => {
            const id = createRandomID("specialist");
            this.dispatchEvent(new NodeCreateEvent(id, "specialist"));
          }}
          @dragstart=${(evt: DragEvent) => {
            if (!evt.dataTransfer) {
              return;
            }
            evt.dataTransfer.setData(this.dataType, "specialist");
          }}
        >
          Add Specialist
        </button>
        <button
          draggable="true"
          id="shortcut-add-human"
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Add Human Component",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @dblclick=${() => {
            const id = createRandomID("human");
            this.dispatchEvent(new NodeCreateEvent(id, "human"));
          }}
          @dragstart=${(evt: DragEvent) => {
            if (!evt.dataTransfer) {
              return;
            }
            evt.dataTransfer.setData(this.dataType, "human");
          }}
        >
          Add Human
        </button>
        <button
          draggable="true"
          id="shortcut-add-looper"
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Add Looper Component",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @dblclick=${() => {
            const id = createRandomID("looper");
            this.dispatchEvent(new NodeCreateEvent(id, "looper"));
          }}
          @dragstart=${(evt: DragEvent) => {
            if (!evt.dataTransfer) {
              return;
            }
            evt.dataTransfer.setData(this.dataType, "looper");
          }}
        >
          Add Looper
        </button>
        <button
          draggable="true"
          id="shortcut-add-comment"
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Add Comment Component",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @dblclick=${() => {
            const id = createRandomID("comment");
            this.dispatchEvent(new NodeCreateEvent(id, "comment"));
          }}
          @dragstart=${(evt: DragEvent) => {
            if (!evt.dataTransfer) {
              return;
            }
            evt.dataTransfer.setData(this.dataType, "comment");
          }}
        >
          Add Comment
        </button>
      </div>
    `;

    const save = html`<button
      class=${classMap({ "show-more": this.canSave })}
      id="shortcut-save"
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent("Save this board", evt.clientX, evt.clientY)
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${() => {
        if (this.canSave) {
          this.showSaveMenu = true;
        } else {
          this.dispatchEvent(new SaveAsEvent());
        }
      }}
    >
      Save
    </button>`;

    let saveMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showSaveMenu) {
      const saveActions: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
      }> = [
        {
          title: "Save Board",
          name: "save",
          icon: "save",
        },
        {
          title: "Save Board As...",
          name: "save-as",
          icon: "save",
        },
      ];

      saveMenu = html`<bb-overflow-menu
        id="save"
        .actions=${saveActions}
        .disabled=${this.graph === null}
        @bboverflowmenudismissed=${() => {
          this.showSaveMenu = false;
        }}
        @bboverflowmenuaction=${() => {
          this.showSaveMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    const copy = html`<button
      id="shortcut-copy"
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent("Copy this board", evt.clientX, evt.clientY)
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${() => {
        this.showCopyMenu = true;
      }}
    >
      Copy
    </button>`;

    let copyMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showCopyMenu) {
      const copyActions: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
      }> = [
        {
          title: "Copy Board Contents",
          name: "copy-board-contents",
          icon: "copy",
        },
        {
          title: "Copy Board URL",
          name: "copy-to-clipboard",
          icon: "copy",
        },
        {
          title: "Copy Tab URL",
          name: "copy-tab-to-clipboard",
          icon: "copy",
        },
        {
          title: "Copy Preview URL",
          name: "copy-preview-to-clipboard",
          icon: "copy",
        },
      ];

      copyMenu = html`<bb-overflow-menu
        id="copy"
        .actions=${copyActions}
        .disabled=${this.graph === null}
        @bboverflowmenudismissed=${() => {
          this.showCopyMenu = false;
        }}
        @bboverflowmenuaction=${() => {
          this.showCopyMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    const editBoardInfo = html` <button
      id="edit-board-info"
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent(
            "Edit board information",
            evt.clientX,
            evt.clientY
          )
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new OverflowMenuActionEvent(
            "edit-board-details",
            evt.clientX,
            evt.clientY
          )
        );
      }}
    >
      Edit board information
    </button>`;

    const deleteBoard = html` <button
      id="delete-board"
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent(
            `Delete this ${this.subGraphId ? `subboard` : `board`}`,
            evt.clientX,
            evt.clientY
          )
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${() => {
        if (this.subGraphId) {
          if (!confirm("Are you sure you wish to delete this sub board?")) {
            return;
          }

          this.dispatchEvent(new SubGraphDeleteEvent(this.subGraphId));
          return;
        }

        this.dispatchEvent(new OverflowMenuActionEvent("delete"));
      }}
    >
      Delete board
    </button>`;

    const editControls = html`<div id="edit-controls">
      <div class="divider"></div>
      <button
        id="undo"
        ?disabled=${!this.canUndo}
        @click=${() => {
          this.dispatchEvent(new UndoEvent());
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              `Undo last action${this.canUndo ? "" : " (unavailable)"}`,
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Undo
      </button>
      <button
        id="redo"
        ?disabled=${!this.canRedo}
        @click=${() => {
          this.dispatchEvent(new RedoEvent());
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              `Redo last action${this.canRedo ? "" : " (unavailable)"}`,
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Redo
      </button>
    </div>`;

    const graphControls = html` <div id="graph-controls">
      <div class="divider"></div>
      <button
        id="zoom-to-fit"
        @click=${() => {
          this.dispatchEvent(new ZoomToFitEvent());
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent("Zoom board to fit", evt.clientX, evt.clientY)
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Zoom to fit
      </button>
      <button
        id="reset-layout"
        @click=${() => {
          this.dispatchEvent(new ResetLayoutEvent());
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent("Reset board layout", evt.clientX, evt.clientY)
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Reset Layout
      </button>
      <button
        id="shortcut-add-subgraph"
        @click=${() => {
          this.dispatchEvent(new AddSubgraphEvent());
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent("Add sub board", evt.clientX, evt.clientY)
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Add sub board
      </button>
      <button
        id="shortcut-select-subgraph"
        @click=${() => {
          this.showSubgraphMenu = true;
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent("Select sub board", evt.clientX, evt.clientY)
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Select sub board
      </button>
    </div>`;

    let subGraphMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showSubgraphMenu) {
      const rawGraph = this.graph?.raw();
      const subGraphs: SubGraphs | null = rawGraph?.graphs
        ? rawGraph.graphs
        : {};

      const actions: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
        secondaryAction?: string;
      }> = Object.entries(subGraphs).map(([id, graph]) => {
        return {
          title: graph.title ?? "Untitled sub board",
          name: id,
          icon: "board",
          disabled: id === this.subGraphId,
          secondaryAction: "delete",
        };
      });

      actions.unshift({
        title: "Main board",
        name: MAIN_BOARD_ID,
        icon: "board",
        disabled: this.subGraphId === null,
      });

      subGraphMenu = html`<bb-overflow-menu
        id="subgraph-menu"
        .disabled=${false}
        .actions=${actions}
        @bboverflowmenudismissed=${() => {
          this.showSubgraphMenu = false;
        }}
        @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
          evt.stopPropagation();
          this.dispatchEvent(new SubGraphChosenEvent(evt.action));
          this.showSubgraphMenu = false;
        }}
        @bboverflowmenusecondaryaction=${(
          evt: OverflowMenuSecondaryActionEvent
        ) => {
          if (!confirm("Are you sure you wish to delete this sub board?")) {
            return;
          }

          if (!evt.value || typeof evt.value !== "string") {
            return;
          }

          evt.stopPropagation();
          this.dispatchEvent(new SubGraphDeleteEvent(evt.value));
          this.showSubgraphMenu = false;

          // Switch out from the subgraph if needed.
          if (this.subGraphId !== evt.value) {
            return;
          }

          this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
        }}
      ></bb-overflow-menu>`;
    }

    const modules = html`<button
      id="shortcut-board-modules"
      @pointerover=${(evt: PointerEvent) => {
        this.dispatchEvent(
          new ShowTooltipEvent("Board Modules", evt.clientX, evt.clientY)
        );
      }}
      @pointerout=${() => {
        this.dispatchEvent(new HideTooltipEvent());
      }}
      @click=${() => {
        this.showBoardModules = true;
      }}
    >
      Modules
    </button>`;

    let moduleMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showBoardModules) {
      const modules: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
      }> = Object.keys(this.graph?.modules() || {}).map((title) => {
        return {
          title,
          name: title,
          icon: "module",
        };
      });

      modules.unshift({
        title: "Main board",
        name: MAIN_BOARD_ID,
        icon: "board",
        disabled: this.moduleId === null,
      });

      moduleMenu = html`<bb-overflow-menu
        id="board-modules-menu"
        .actions=${modules}
        .disabled=${this.graph === null}
        @bboverflowmenudismissed=${() => {
          this.showBoardModules = false;
        }}
        @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
          this.showBoardModules = false;
          evt.stopImmediatePropagation();

          this.dispatchEvent(new ModuleChosenEvent(evt.action));
        }}
      ></bb-overflow-menu>`;
    }

    const boardManagementControls = [
      html`<div class="divider"></div>`,
      editBoardInfo,
      save,
      copy,
      deleteBoard,
    ];

    const boardManagement = html`<div id="board-management">
      ${boardManagementControls}
    </div>`;

    const overflow = html`<button
      id="shortcut-overflow"
      ${ref(this.#overflowMenuToggleRef)}
      @click=${() => {
        this.showOverflowMenu = true;
      }}
    >
      See more...
    </button>`;

    let overflowMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showOverflowMenu) {
      for (const action of this.#overflowActions) {
        if (action.title === "Undo") {
          action.disabled = !this.canUndo;
        }

        if (action.title === "Redo") {
          action.disabled = !this.canRedo;
        }

        if (action.title === "Save") {
          action.disabled = !this.canSave;
        }
      }

      overflowMenu = html`<bb-overflow-menu
        id="overflow-menu"
        .disabled=${false}
        .actions=${this.#overflowActions}
        @bboverflowmenudismissed=${() => {
          this.showOverflowMenu = false;
        }}
        @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
          switch (evt.action) {
            case "undo": {
              evt.stopPropagation();
              this.dispatchEvent(new UndoEvent());
              break;
            }

            case "redo": {
              evt.stopPropagation();
              this.dispatchEvent(new RedoEvent());
              break;
            }

            case "zoom-board-to-fit": {
              evt.stopPropagation();
              this.dispatchEvent(new ZoomToFitEvent());
              break;
            }

            case "reset-board-layout": {
              evt.stopPropagation();
              this.dispatchEvent(new ResetLayoutEvent());
              break;
            }

            case "add-sub-graph": {
              evt.stopPropagation();
              this.dispatchEvent(new AddSubgraphEvent());
              break;
            }
          }

          this.showOverflowMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    const moduleManagement = [
      html`<div class="divider"></div>`,
      modules,
      moduleMenu,
    ];

    const left = [
      componentSelector,
      components,
      boardManagement,
      editControls,
      graphControls,
      moduleManagement,
      overflow,
    ];

    const right = [
      html`<button
        id="follow"
        class=${classMap({ active: this.follow })}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              "Follow board activity",
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          this.dispatchEvent(new ToggleFollowEvent());
        }}
      >
        Follow
      </button>`,
      html`<button
        id="board-activity"
        ${ref(this.#boardActivityRef)}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent("See board activity", evt.clientX, evt.clientY)
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          this.#showBoardActivity();
        }}
      >
        <span
          class=${classMap({
            error: this.isError,
            pending: this.isInputPending,
          })}
          >${this.eventCount}</span
        >
      </button>`,
      html`<button
        id="run"
        title="Run this board"
        ?disabled=${!this.graph || this.readOnly}
        class=${classMap({ running: this.isRunning })}
        @pointerdown=${(evt: PointerEvent) => {
          // We do this to prevent the pointer event firing and dismissing the
          // board activity overlay. Otherwise the overlay disappears and then
          // immediately reappears.
          evt.stopImmediatePropagation();
        }}
        @click=${() => {
          if (this.isRunning) {
            this.dispatchEvent(new StopEvent());
          } else {
            this.#showBoardActivity(true);
            this.dispatchEvent(new RunEvent());
          }
        }}
      >
        ${this.isRunning ? "Stop Board" : "Run Board"}
      </button>`,
    ];

    return [
      html`<div id="left">${left}</div>`,
      html`<div id="right">${right}</div>`,
      saveMenu,
      copyMenu,
      overflowMenu,
      subGraphMenu,
    ];
  }
}
