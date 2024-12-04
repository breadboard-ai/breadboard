/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  HideTooltipEvent,
  RedoEvent,
  RunEvent,
  ShowTooltipEvent,
  StopEvent,
  UndoEvent,
  ZoomToFitEvent,
} from "../../events/events";
import { InspectableGraph } from "@google-labs/breadboard";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-graph-ribbon-menu")
export class GraphRibbonMenu extends LitElement {
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
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size);
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
      left: 60px;
      right: auto;
    }

    #copy {
      position: absolute;
      top: calc(100% + -8px);
      left: 104px;
      right: auto;
    }

    #subgraph-menu {
      position: absolute;
      top: calc(100% + -8px);
      left: 700px;
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

    #shortcut-board-modules.ts {
      background-image: var(--bb-icon-extension-ts),
        var(--bb-icon-arrow-drop-down);
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
      width: 76px;
      height: var(--bb-grid-size-7);
      background: var(--bb-inputs-600) var(--bb-icon-play-filled-inverted) 8px
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
      background: var(--bb-inputs-600) url(/images/progress-ui-inverted.svg) 8px
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

  render() {
    const editControls = html`<div id="edit-controls">
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
    </div>`;

    const left = [
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
            this.dispatchEvent(new RunEvent());
          }
        }}
      >
        ${this.isRunning ? "Stop" : "Run"}
      </button>`,
    ];

    const right = [editControls, graphControls];
    return [
      html`<div id="left">${left}</div>`,
      html`<div id="right">${right}</div>`,
    ];
  }
}
