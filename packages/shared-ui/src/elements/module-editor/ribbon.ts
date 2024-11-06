/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  HideTooltipEvent,
  ModuleChosenEvent,
  ModuleCreateEvent,
  ModuleDeleteEvent,
  OverflowMenuActionEvent,
  OverflowMenuSecondaryActionEvent,
  RunEvent,
  ShowTooltipEvent,
  StopEvent,
  ToggleBoardActivityEvent,
} from "../../events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { InspectableGraph, InspectableModules } from "@google-labs/breadboard";
import { classMap } from "lit/directives/class-map.js";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { ModuleIdentifier } from "@breadboard-ai/types";

const COLLAPSED_MENU_BUFFER = 60;

@customElement("bb-module-ribbon-menu")
export class ModuleRibbonMenu extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  modules: InspectableModules = {};

  @property()
  moduleId: string | null = null;

  @property()
  readOnly = true;

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
  showBoardModules = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      position: relative;
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
      left: 4px;
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

    #left button#component-toggle,
    #left button#shortcut-board-modules {
      margin: 0 var(--bb-grid-size) 0 0;
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
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      width: auto;
      padding: 0 20px 0 28px;
      background: var(--bb-neutral-0);
      background-image: var(--bb-icon-extension), var(--bb-icon-arrow-drop-down);
      background-position:
        -2px center,
        right center;
      background-size:
        20px 20px,
        20px 20px;
      background-repeat: no-repeat, no-repeat;
      margin-right: var(--bb-grid-size);
    }

    #shortcut-board-modules.main {
      background-image: var(--bb-icon-board), var(--bb-icon-arrow-drop-down);
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
  #segmentThresholds = new WeakMap<Element, { left: number; right: number }>();
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
          default:
            break;
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

  protected firstUpdated(): void {
    this.#resizeObserver.observe(this);
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
    const modules = html`<button
      id="shortcut-board-modules"
      class=${classMap({ main: this.moduleId === null })}
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
      ${this.moduleId ? this.moduleId : "Main board"}
    </button>`;

    let moduleMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showBoardModules) {
      const modules: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
        secondaryAction?: string;
      }> = Object.keys(this.modules || {}).map((title) => {
        return {
          title,
          name: title,
          icon: "module",
          disabled: this.moduleId === title,
          secondaryAction: "delete",
        };
      });

      modules.unshift({
        title: "Main board",
        name: MAIN_BOARD_ID,
        icon: "board",
        disabled: this.moduleId === null,
      });

      modules.push({
        title: "Create new module...",
        name: "create-module",
        icon: "add-circle",
      });

      moduleMenu = html`<bb-overflow-menu
        id="board-modules-menu"
        .actions=${modules}
        .disabled=${this.moduleId === null}
        @bboverflowmenudismissed=${() => {
          this.showBoardModules = false;
        }}
        @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
          this.showBoardModules = false;
          evt.stopImmediatePropagation();

          if (evt.action === "create-module") {
            let moduleId;

            do {
              moduleId = prompt("What would you like to call this module?");
              if (!moduleId) {
                return;
              }
              // Check that the new module name is valid.
            } while (!/^[A-Za-z0-9_\\-]+$/gim.test(moduleId));

            this.dispatchEvent(new ModuleCreateEvent(moduleId));
            return;
          }

          let moduleId: ModuleIdentifier | null = evt.action;
          if (evt.action === MAIN_BOARD_ID) {
            moduleId = null;
          }

          this.dispatchEvent(new ModuleChosenEvent(moduleId));
        }}
        @bboverflowmenusecondaryaction=${(
          evt: OverflowMenuSecondaryActionEvent
        ) => {
          this.showBoardModules = false;
          evt.stopImmediatePropagation();

          if (!evt.value) {
            return;
          }

          const id = evt.value as ModuleIdentifier;
          if (!confirm(`Are you sure you wish to delete the "${id}" module?`)) {
            return;
          }

          this.dispatchEvent(new ModuleDeleteEvent(id));
        }}
      ></bb-overflow-menu>`;
    }

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
        @bboverflowmenuaction=${(_evt: OverflowMenuActionEvent) => {
          this.showOverflowMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    const moduleManagement = [modules, moduleMenu];

    const left = [moduleManagement, overflow];
    const right = [
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
      overflowMenu,
    ];
  }
}
