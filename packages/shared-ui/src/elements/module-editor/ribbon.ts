/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import * as StringsHelper from "../../strings/helper.js";
const GlobalStrings = StringsHelper.forSection("Global");

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  FormatModuleCodeEvent,
  HideTooltipEvent,
  ModuleChangeLanguageEvent,
  RunEvent,
  ShowTooltipEvent,
  StopEvent,
  ToggleModulePreviewEvent,
} from "../../events/events";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { InspectableGraph, InspectableModules } from "@google-labs/breadboard";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-module-ribbon-menu")
export class ModuleRibbonMenu extends LitElement {
  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor modules: InspectableModules = {};

  @property()
  accessor moduleId: string | null = null;

  @property()
  accessor readOnly = true;

  @property()
  accessor follow = false;

  @property()
  accessor isRunning = false;

  @property()
  accessor showExperimentalComponents = false;

  @property()
  accessor canSave = false;

  @property()
  accessor eventCount = 0;

  @property()
  accessor errorCount = 0;

  @property()
  accessor errorDetails: Array<{ message: string; start: number }> | null =
    null;

  @property()
  accessor showErrors = false;

  @property()
  accessor isInputPending = false;

  @property()
  accessor isError = false;

  @property({ reflect: true })
  accessor isShowingBoardActivityOverlay = false;

  @property({ reflect: true })
  accessor isShowingModulePreview = false;

  @property()
  accessor canShowModulePreview = false;

  @property()
  accessor formatting = false;

  @property()
  accessor renderId: string | null = null;

  @property()
  accessor canUndo = false;

  @property()
  accessor canRedo = false;

  @state()
  accessor showSaveMenu = false;

  @state()
  accessor showErrorMenu = false;

  @state()
  accessor showCopyMenu = false;

  @state()
  accessor showOverflowMenu = false;

  @state()
  accessor showBoardModules = false;

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
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size);
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

    #board-management,
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

    #edit-board-info,
    #shortcut-save,
    #shortcut-copy,
    #delete-board,
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

    #edit-board-info:hover,
    #edit-board-info:focus,
    #shortcut-save:hover,
    #shortcut-save:focus,
    #shortcut-copy:hover,
    #shortcut-copy:focus,
    #delete-board:hover,
    #delete-board:focus,
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

    #errors-toggle {
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      background: var(--bb-neutral-50);
      border: none;
      border-radius: var(--bb-grid-size);
      min-width: 70px;
      text-align: center;
      user-select: none;
      cursor: default;
    }

    #errors-toggle.has-errors {
      cursor: pointer;
      margin-left: var(--bb-grid-size-2);
      padding: var(--bb-grid-size);
      background: var(--bb-warning-400);
      color: var(--bb-neutral-0);
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

    #save {
      position: absolute;
      top: calc(100% + -8px);
      left: 7px;
      right: auto;
    }

    #errors {
      cursor: default;
      position: absolute;
      top: calc(100% + -8px);
      left: var(--error-left, 494px);
      right: auto;
    }

    #errors.available {
      cursor: pointer;
    }

    #copy {
      position: absolute;
      top: calc(100% + -8px);
      left: 51px;
      right: auto;
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

  #runnableModuleInputRef: Ref<HTMLInputElement> = createRef();

  moduleIsRunnable(): boolean {
    if (!this.#runnableModuleInputRef.value) {
      return false;
    }

    return this.#runnableModuleInputRef.value.checked;
  }

  render() {
    const module = this.modules[this.moduleId ?? ""] ?? null;
    const isTypeScript = module.metadata().source?.language === "typescript";
    const isMainModule = this.graph?.main() === this.moduleId;

    const moduleIsRunnable = !!(module && module.metadata().runnable);
    const moduleControls = html`<div id="module-controls">
      <div id="start">
        <button
          id="run"
          title=${GlobalStrings.from("LABEL_RUN_PROJECT")}
          class=${classMap({ running: this.isRunning })}
          ?disabled=${this.readOnly}
          @click=${() => {
            if (this.isRunning) {
              this.dispatchEvent(new StopEvent());
            } else {
              this.dispatchEvent(new RunEvent());
            }
          }}
        >
          ${this.isRunning
            ? GlobalStrings.from("LABEL_STOP")
            : GlobalStrings.from("LABEL_RUN")}
        </button>
      </div>
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
        ?disabled=${!this.canShowModulePreview || isMainModule}
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
          ?disabled=${isMainModule}
          .checked=${moduleIsRunnable || isMainModule}
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
                "Make available as a component",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          >Component</label
        >
      </div>
    </div>`;

    let errorMenu: HTMLTemplateResult | symbol = nothing;
    if (this.showErrorMenu && this.errorDetails) {
      const errorActions: Array<{
        title: string;
        name: string;
        icon: string;
        disabled?: boolean;
        secondaryAction?: string;
      }> = this.errorDetails.map((error) => {
        return {
          title: error.message,
          name: `error-${error.start}`,
          icon: "error",
        };
      });

      errorMenu = html`<bb-overflow-menu
        id="errors"
        .actions=${errorActions}
        .disabled=${this.graph === null}
        @bboverflowmenudismissed=${() => {
          this.showErrorMenu = false;
        }}
        @bboverflowmenuaction=${() => {
          this.showErrorMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    const errors = this.showErrors
      ? html`<button
            id="errors-toggle"
            class=${classMap({ "has-errors": this.errorCount > 0 })}
            @pointerover=${(evt: PointerEvent) => {
              this.dispatchEvent(
                new ShowTooltipEvent("Show errors", evt.clientX, evt.clientY)
              );
            }}
            @pointerout=${() => {
              this.dispatchEvent(new HideTooltipEvent());
            }}
            @click=${(evt: Event) => {
              if (!(evt.target instanceof HTMLElement)) {
                return;
              }

              const { left } = evt.target.getBoundingClientRect();
              this.style.setProperty("--error-left", `${left}px`);

              this.showErrorMenu = true;
            }}
          >
            ${this.errorCount} error${this.errorCount === 1 ? "" : "s"}
          </button>
          <div class="divider"></div>`
      : nothing;

    const right = [errors, moduleControls];

    return [
      html`<div id="left"></div>`,
      html`<div id="right">${right}</div>`,
      errorMenu,
    ];
  }
}
