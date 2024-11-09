/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  FormatModuleCodeEvent,
  HideTooltipEvent,
  ModuleChangeLanguageEvent,
  ModuleChosenEvent,
  ModuleCreateEvent,
  ModuleDeleteEvent,
  OverflowMenuActionEvent,
  OverflowMenuSecondaryActionEvent,
  RunEvent,
  ShowTooltipEvent,
  StopEvent,
  ToggleBoardActivityEvent,
  ToggleModulePreviewEvent,
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

  @property()
  eventCount = 0;

  @property()
  errorCount = 0;

  @property()
  showErrors = false;

  @property()
  isInputPending = false;

  @property()
  isError = false;

  @property({ reflect: true })
  isShowingBoardActivityOverlay = false;

  @property({ reflect: true })
  isShowingModulePreview = false;

  @property()
  canShowModulePreview = false;

  @property()
  formatting = false;

  @property()
  renderId: string | null = null;

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

    input[type="text"],
    select,
    textarea {
      padding: var(--bb-grid-size) var(--bb-grid-size);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
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

    #module-controls {
      display: flex;
      height: 100%;
      align-items: center;
      flex: 0 0 auto;
    }

    #module-controls.hidden {
      display: none;
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

    #shortcut-board-modules,
    #toggle-preview,
    #shortcut-overflow,
    #format-code {
      width: 20px;
      height: 20px;
      background: red;
      border: none;
      border-radius: var(--bb-grid-size);
      opacity: 0.6;
      font-size: 0;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #toggle-preview {
      background: var(--bb-neutral-0) var(--bb-icon-preview) center center /
        20px 20px no-repeat;
    }

    #toggle-preview[disabled] {
      opacity: 0.3;
    }

    :host([isshowingmodulepreview="true"]) #toggle-preview {
      background-color: var(--bb-ui-100);
    }

    #format-code {
      background: var(--bb-neutral-0) var(--bb-icon-braces) center center / 20px
        20px no-repeat;
      margin-left: var(--bb-grid-size-4);
    }

    #format-code[disabled] {
      opacity: 0.3;
    }

    button {
      padding: 0;
    }

    button:not([disabled]) {
      cursor: pointer;
    }

    #left button {
      margin: 0 var(--bb-grid-size);
    }

    #left button#shortcut-board-modules {
      margin: 0 var(--bb-grid-size) 0 0;
    }

    #right button {
      margin-left: var(--bb-grid-size-2);
    }

    #shortcut-overflow {
      background: var(--bb-neutral-0) var(--bb-icon-more-vert) center center /
        20px 20px no-repeat;
      display: none;
    }

    #format-code:hover,
    #format-code:focus,
    #shortcut-board-modules:hover,
    #shortcut-board-modules:focus {
      transition-duration: 0.1s;
      opacity: 1;
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

    #shortcut-overflow.visible {
      display: block;
    }

    #language-selector-container {
      margin-right: var(--bb-grid-size-2);
    }

    #language-selector-container label {
      margin-right: var(--bb-grid-size);
    }

    .hidden {
      display: none;
    }

    #runnable {
      display: flex;
      align-items: center;
      margin-left: var(--bb-grid-size-2);
    }

    label[for="mark-runnable"] {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-700);
      margin-left: var(--bb-grid-size);
    }

    #errors {
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      background: var(--bb-neutral-50);
      border-radius: var(--bb-grid-size);
      min-width: 70px;
      text-align: center;
      user-select: none;
    }

    #errors.has-errors {
      margin-left: var(--bb-grid-size-2);
      padding: var(--bb-grid-size);
      background: var(--bb-warning-400);
      color: var(--bb-neutral-0);
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
  #runnableModuleInputRef: Ref<HTMLInputElement> = createRef();
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

  moduleIsRunnable(): boolean {
    if (!this.#runnableModuleInputRef.value) {
      return false;
    }

    return this.#runnableModuleInputRef.value.checked;
  }

  render() {
    const module = this.modules[this.moduleId ?? ""] ?? null;
    const isTypeScript = module.metadata().source?.language === "typescript";

    const modules = html`<button
      id="shortcut-board-modules"
      class=${classMap({
        main: this.moduleId === null,
        ts: isTypeScript,
      })}
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
      }> = Object.entries(this.modules || {})
        .map(([title, module]) => {
          return {
            title,
            name: title,
            icon:
              module.metadata().source?.language === "typescript"
                ? "module-ts"
                : "module",
            disabled: this.moduleId === title,
            secondaryAction: "delete",
          };
        })
        .sort((a, b) => (a.title > b.title ? 1 : a.title < b.title ? -1 : 0));

      if (!this.graph?.imperative()) {
        modules.unshift({
          title: "Main board",
          name: MAIN_BOARD_ID,
          icon: "board",
          disabled: this.moduleId === null,
        });
      }

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

    const moduleSelector = [modules, moduleMenu];
    const moduleIsRunnable = !!(module && module.metadata().runnable);
    const moduleControls = html`<div id="module-controls">
      <div class="divider"></div>
      <div id="language-selector-container">
        <label for="language-selector">Language</label>
        <select
          id="language-selector"
          @input=${(evt: InputEvent) => {
            if (!confirm("Are you sure you wish to change module language?")) {
              return;
            }

            if (!(evt.target instanceof HTMLSelectElement) || !this.moduleId) {
              return;
            }

            this.dispatchEvent(
              new ModuleChangeLanguageEvent(this.moduleId, evt.target.value)
            );
          }}
        >
          <option value="javascript" ?selected=${!isTypeScript}>
            JavaScript
          </option>
          <option value="typescript" ?selected=${isTypeScript}>
            TypeScript
          </option>
        </select>
      </div>

      <button
        id="format-code"
        ?disabled=${this.formatting}
        @click=${() => {
          this.dispatchEvent(new FormatModuleCodeEvent());
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              `Format Module Code ${this.formatting ? "(running)" : ""}`,
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Format Module Code
      </button>
      <button
        id="toggle-preview"
        ?disabled=${!this.canShowModulePreview}
        @click=${() => {
          this.dispatchEvent(new ToggleModulePreviewEvent());
        }}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              `Toggle Module Preview ${moduleIsRunnable ? "" : "(disabled)"}`,
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
      >
        Toggle Module Preview
      </button>

      <div id="runnable">
        <input
          ${ref(this.#runnableModuleInputRef)}
          .checked=${moduleIsRunnable}
          .value=${"true"}
          type="checkbox"
          id="mark-runnable"
          name="mark-runnable"
        />
        <label
          for="mark-runnable"
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Make available to runModule",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          >Runnable</label
        >
      </div>
    </div>`;

    const errors = this.showErrors
      ? html`<div class="divider"></div>
          <div
            id="errors"
            class=${classMap({ "has-errors": this.errorCount > 0 })}
          >
            ${this.errorCount} error${this.errorCount === 1 ? "" : "s"}
          </div>`
      : nothing;

    const left = [moduleSelector, moduleControls, errors, overflow];
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
