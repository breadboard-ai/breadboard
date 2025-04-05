/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LLMContent } from "@breadboard-ai/types";
import {
  BoardServer,
  GraphDescriptor,
  isLLMContent,
  isLLMContentArray,
  NodeValue,
  TemplatePartTransformCallback,
  UnresolvedPathBoardCapability,
} from "@google-labs/breadboard";
import {
  css,
  html,
  HTMLTemplateResult,
  LitElement,
  nothing,
  PropertyValues,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  EnhanceNodeConfigurationEvent,
  EnhanceNodeResetEvent,
  HideTooltipEvent,
  ModuleCreateEvent,
  ShowTooltipEvent,
  UserOutputEvent,
  WorkspaceSelectionStateEvent,
} from "../../events/events";
import { Project } from "../../state";
import { UserInputConfiguration, UserOutputValues } from "../../types/types";
import {
  isBoardBehavior,
  isCodeBehavior,
  isEnum,
  isGoogleDriveFileId,
  isGoogleDriveQuery,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
  isModuleBehavior,
  isPortSpecBehavior,
} from "../../utils/index.js";
import {
  createAllowListFromProperty,
  getMinItemsFromProperty,
} from "../../utils/llm-content";
import { getModuleId } from "../../utils/module-id";
import {
  assertIsLLMContent,
  assertIsLLMContentArray,
  resolveArrayType,
  resolveBehaviorType,
} from "../../utils/schema";
import * as Utils from "../../utils/utils.js";
import {
  CodeEditor,
  LLMInput,
  LLMInputArray,
  StreamlinedSchemaEditor,
} from "../elements";
import "./delegating-input.js";
import { isSingleLineBehavior } from "../../utils/behaviors";

const NO_MODULE = " -- No module";

@customElement("bb-user-input")
export class UserInput extends LitElement {
  @property()
  accessor nodeId: string | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor inputs: UserInputConfiguration[] = [];

  @property()
  accessor showTitleInfo = true;

  @property()
  accessor useChatInput = false;

  @property({ reflect: true })
  accessor chatAudioWaveColor: string | null = "#ff00ff";

  @property()
  accessor useDebugChatInput = false;

  @property()
  accessor showChatContinueButton = false;

  @property()
  accessor jumpTo: string | null = null;

  @property()
  accessor showTypes = false;

  @property({ reflect: true })
  accessor inlineControls = false;

  @property({ reflect: true })
  accessor llmInputClamped = false;

  @property()
  accessor llmInputStreamlined = false;

  @property()
  accessor llmInputShowPartControls = true;

  @property()
  accessor llmShowInlineControlsToggle = true;

  @property()
  accessor llmInputShowEntrySelector = true;

  @property()
  accessor graph: GraphDescriptor | null = null;

  @property()
  accessor boardServers: BoardServer[] = [];

  @property({ reflect: true })
  accessor readOnly = false;

  @property()
  accessor enhancingInput = new Set<string>();

  @property()
  accessor projectState: Project | null = null;

  #formRef: Ref<HTMLFormElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: relative;
      color: var(--bb-neutral-900);
    }

    :host([readonly="true"])::after {
      content: "";
      position: absolute;
      background: var(--bb-neutral-0);
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 1;
      opacity: 0.4;
    }

    .item {
      scroll-margin-top: var(--bb-grid-size-2);
      color: var(--bb-neutral-900);
      margin-bottom: var(--bb-grid-size-4);

      & .title {
        display: flex;
        align-items: center;
        font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        margin-bottom: var(--bb-grid-size);
      }

      & .input {
        padding-left: var(--user-input-padding-left, 0);
      }

      & label {
        padding: 0 0 var(--bb-grid-size) 0;
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        display: block;

        & .description {
          display: flex;
          align-items: center;
        }

        &:empty {
          display: none;
        }
      }

      &:has(input[type="checkbox"]) {
        & label {
          display: flex;
          padding-left: 0;

          &::before {
            content: "";
            display: block;
            width: 20px;
            height: 20px;
            border-radius: var(--bb-grid-size);
            border: 1px solid var(--bb-neutral-300);
            flex: 0 0 auto;
            margin-right: var(--bb-grid-size-2);
          }

          &:has(+ .input > input:checked)::before {
            background: var(--bb-icon-check) center center / 20px 20px no-repeat;
          }

          &:focus {
            outline: none;

            &::before {
              border: 1px solid var(--bb-ui-700);
              outline: 1px solid var(--bb-ui-700);
            }
          }
        }

        & input {
          display: none;
        }
      }
    }

    .item:last-of-type {
      margin-bottom: 0;
    }

    .item input[type="checkbox"] {
      margin: 0;
    }

    .item input[type="text"],
    .item input[type="number"],
    .item textarea,
    .item select {
      display: block;
      width: 100%;
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0);
      color: var(--bb-neutral-900);
      padding: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);

      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .item textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    .item .module-selector {
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size-3) 0;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: var(--bb-grid-size);
      row-gap: var(--bb-grid-size);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .item .module-title {
      font: 500 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-800);
      margin: var(--bb-grid-size) 0;
      display: block;
    }

    .item .module-title:empty {
      margin: 0;
    }

    .item .module-description {
      color: var(--bb-neutral-600);
      margin: var(--bb-grid-size) 0;
      display: block;
    }

    .item .module-description:empty {
      margin: 0;
    }

    .item .module {
      border-radius: var(--bb-grid-size);
    }

    .item .module input {
      display: none;
    }

    .item .module label {
      padding-bottom: 32px;
      background: var(--bb-neutral-0);
      display: block;
      padding: var(--bb-grid-size-2);
      padding-bottom: var(--bb-grid-size-10);
      cursor: pointer;
      position: relative;
      height: 100%;
      border: 1px solid var(--bb-ui-200);
      border-radius: var(--bb-grid-size);
      transition: background-color 0.15s cubic-bezier(0, 0, 0.3, 1);
    }

    .item .module label:hover {
      border: 1px solid var(--bb-ui-300);
      background: var(--bb-ui-50);
    }

    .item .module input:checked + label {
      border: 1px solid var(--bb-ui-400);
      background: var(--bb-ui-50);
      cursor: default;
    }

    .api-message {
      color: var(--bb-neutral-800);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: 0 0 var(--bb-grid-size-2) 0;
    }

    .title-value {
      flex: 1;
    }

    .jump-to-definition,
    .enhance {
      border: none;
      border-radius: var(--bb-grid-size-6);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      background: var(--bb-ui-400) var(--bb-icon-enhance-inverted) 6px center /
        16px 16px no-repeat;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-0);
      cursor: pointer;
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
    }

    .jump-to-definition:hover,
    .jump-to-definition:focus,
    .enhance:hover,
    .enhance:focus {
      background-color: var(--bb-ui-500);
    }

    .jump-to-definition[disabled],
    .enhance[disabled] {
      opacity: 0.8;
      cursor: normal;
    }

    .enhance.active {
      background: var(--bb-ui-400) url(/images/progress-ui-inverted.svg) 4px
        center / 16px 16px no-repeat;
    }

    .enhance-container {
      display: flex;
      flex: 0 0 auto;
    }

    .jump-to-definition {
      position: absolute;
      bottom: var(--bb-grid-size);
      right: var(--bb-grid-size);
      font-size: 0;
      width: var(--bb-grid-size-7);
      height: var(--bb-grid-size-7);
      padding: 0;
      background-image: var(--bb-icon-extension-inverted);
    }

    .create-new-module {
      border-radius: var(--bb-grid-size-6);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      background: var(--bb-neutral-0) var(--bb-icon-add-circle) 6px center /
        16px 16px no-repeat;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-900);
      cursor: pointer;
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
      border: 1px solid var(--bb-neutral-300);
    }

    .create-new-module:hover,
    .create-new-module:focus {
      background-color: var(--bb-neutral-50);
    }

    .reset {
      border: none;
      border-radius: var(--bb-grid-size-6);
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      background: transparent;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-500);
      cursor: pointer;
      transition: color 0.1s cubic-bezier(0, 0, 0.3, 1);
      display: none;
    }

    .enhance:hover,
    .enhance:focus {
      background-color: var(--bb-ui-500);
    }

    .reset.visible {
      display: block;
    }
  `;

  protected firstUpdated(changedProperties: PropertyValues): void {
    if (!changedProperties.has("jumpTo")) {
      return;
    }

    requestAnimationFrame(() => {
      if (!this.#formRef.value) {
        return;
      }

      if (!this.jumpTo) {
        return;
      }

      const item = this.#formRef.value.querySelector(
        `#container-${this.#createId(this.jumpTo)}`
      );
      item?.scrollIntoView({
        behavior: "instant",
        block: "start",
        inline: "start",
      });
    });
  }

  destroyEditors() {
    // Here we must unhook the editor *before* it is removed from the DOM,
    // otherwise CodeMirror will hold onto focus if it has it.
    if (!this.#formRef.value) {
      return;
    }

    for (const editor of this.#formRef.value.querySelectorAll<CodeEditor>(
      "bb-code-editor"
    )) {
      editor.destroy();
    }

    for (const editor of this.#formRef.value.querySelectorAll<StreamlinedSchemaEditor>(
      "bb-streamlined-schema-editor"
    )) {
      editor.destroyEditorsIfNeeded();
    }
  }

  #onFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();
  }

  processData(
    showValidationErrors: boolean,
    componentParamCallback: TemplatePartTransformCallback = (part) => part
  ) {
    if (!this.#formRef.value) {
      return null;
    }

    if (!this.#formRef.value.checkValidity()) {
      if (showValidationErrors) {
        this.#formRef.value.reportValidity();
      }
      return null;
    }

    for (const editor of this.#formRef.value.querySelectorAll<StreamlinedSchemaEditor>(
      "bb-streamlined-schema-editor"
    )) {
      if (!editor.checkValidity()) {
        editor.reportValidity();
        return null;
      }
    }

    const outputs: UserOutputValues = this.inputs
      .filter((input) => input.schema)
      .map((input) => {
        // Assume all form elements and Custom Elements conform to the rough
        // shape of the HTMLInputElement insofar as they have a .value property
        // on them.
        const id = this.#createId(input.name);
        let el = this.#formRef.value?.querySelector<HTMLInputElement>(`#${id}`);
        if (!el) {
          el = this.#formRef.value?.querySelector<HTMLInputElement>(
            `input[name="${id}"]:checked`
          );

          if (!el) {
            console.warn(`Unable to locate element for #${id} (${input.name})`);
            return { name: input.name, value: null };
          }
        }

        let inputValue: NodeValue = el.value;
        if (input.schema) {
          switch (input.schema.type) {
            case "number": {
              inputValue = Number.parseFloat(inputValue);
              if (Number.isNaN(inputValue)) {
                inputValue = null;
              }
              break;
            }

            case "boolean": {
              inputValue = el.checked;
              break;
            }

            case "object":
            case "array": {
              if (
                isPortSpecBehavior(input.schema) ||
                isLLMContentBehavior(input.schema) ||
                isLLMContentArrayBehavior(input.schema) ||
                isBoardBehavior(input.schema)
              ) {
                if (isLLMContentArrayBehavior(input.schema)) {
                  (el as unknown as LLMInputArray).processAllOpenParts(
                    componentParamCallback
                  );
                } else if (isLLMContentBehavior(input.schema)) {
                  (el as unknown as LLMInput).processAllOpenParts(
                    componentParamCallback
                  );
                }
                break;
              }

              // The ArrayEditor returns a JSON serialized string for its value
              // so we decode that here.
              try {
                if (typeof inputValue === "string" && inputValue !== "") {
                  inputValue = JSON.parse(inputValue);
                }
              } catch (err) {
                // Ignore errors.
                console.warn(
                  `Unexpected input for "${input.name}"`,
                  inputValue
                );
                console.warn(err);
              }
              break;
            }
          }
        }

        return { name: input.name, value: inputValue };
      })
      .reduce((prev, curr) => {
        if (
          curr.value !== "" &&
          curr.value !== null &&
          curr.value !== undefined
        ) {
          prev[curr.name] = curr.value;
        }

        return prev;
      }, {} as UserOutputValues);

    return outputs;
  }

  #emitProcessedData() {
    const outputs = this.processData(false);
    if (!outputs) {
      return;
    }

    this.dispatchEvent(new UserOutputEvent(outputs));
  }

  #createId(name: string) {
    return name
      .toLocaleLowerCase()
      .replace(/[\s\W]/gi, "-")
      .replace(/^\$/, "__");
  }

  #shouldAttemptFocus = false;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("inputs")) {
      this.enhancingInput.clear();
      this.#shouldAttemptFocus = true;
    }
  }

  protected updated(): void {
    if (!this.#shouldAttemptFocus) {
      return;
    }

    this.#shouldAttemptFocus = false;
    if (!this.#formRef.value) {
      return;
    }

    const input = this.#formRef.value.querySelector<HTMLInputElement>("input");
    input?.select();
  }

  #updateModuleDescriptionIfNeeded(evt: InputEvent) {
    if (!(evt.target instanceof HTMLSelectElement)) {
      return;
    }

    if (!evt.target.classList.contains("module-selector")) {
      return;
    }

    if (!this.#formRef.value) {
      return;
    }

    const selectorId = evt.target.id;
    const label = this.#formRef.value.querySelector(
      `label[for="${selectorId}"]`
    );
    if (!label) {
      return;
    }

    const moduleDescription =
      this.graph?.modules?.[evt.target.value]?.metadata?.description;
    label.textContent = moduleDescription ?? "";
  }

  render() {
    const createBoardInput = (
      id: string,
      value?: UnresolvedPathBoardCapability | string
    ) => {
      return html`<bb-board-selector
        id="${id}"
        name="${id}"
        .graph=${this.graph}
        .subGraphs=${this.graph?.graphs ?? null}
        .boardServers=${this.boardServers}
        .value=${value}
      ></bb-board-selector>`;
    };

    return html`<form
      ${ref(this.#formRef)}
      @input=${(evt: InputEvent) => {
        this.#emitProcessedData();
        this.#updateModuleDescriptionIfNeeded(evt);
      }}
      @bbcodechange=${this.#emitProcessedData}
      @submit=${this.#onFormSubmit}
    >
      ${this.inputs.length === 0 &&
      (this.useChatInput || this.useDebugChatInput)
        ? this.useChatInput
          ? html`<bb-llm-input-chat
              .pending=${true}
              .schema=${null}
              .value=${null}
              .description=${null}
              .clamped=${this.llmInputClamped}
              .nodeId=${this.nodeId}
              .subGraphId=${this.subGraphId}
              .projectState=${this.projectState}
              .showChatContinueButton=${this.showChatContinueButton}
              .audioWaveColor=${this.chatAudioWaveColor}
            ></bb-llm-input-chat>`
          : this.useDebugChatInput
            ? html`<bb-llm-input-chat-debug
                .pending=${true}
                .schema=${null}
                .value=${null}
                .description=${null}
                .clamped=${this.llmInputClamped}
                .nodeId=${this.nodeId}
                .subGraphId=${this.subGraphId}
                .projectState=${this.projectState}
                .showChatContinueButton=${this.showChatContinueButton}
              ></bb-llm-input-chat-debug>`
            : nothing
        : nothing}
      ${map(this.inputs, (input) => {
        let inputField: HTMLTemplateResult | symbol = nothing;
        let description: HTMLTemplateResult | symbol = nothing;

        if (input.schema) {
          if (Array.isArray(input.schema.type)) {
            input.schema.type = typeof input.value;
          }

          if (
            input.schema.description &&
            !isLLMContentBehavior(input.schema) &&
            !isLLMContentArrayBehavior(input.schema)
          ) {
            description = html`<span class="description"
              >${input.schema.description}</span
            >`;
          }

          let unparsedDefaultValue = "";
          if (input.schema.examples && input.schema.examples.length > 0) {
            unparsedDefaultValue = input.schema.examples[0];
          } else if (typeof input.schema.default === "string") {
            unparsedDefaultValue = input.schema.default;
          } else if (isLLMContentArrayBehavior(input.schema)) {
            if (
              typeof input.schema.items === "object" &&
              !Array.isArray(input.schema.items)
            ) {
              unparsedDefaultValue = input.schema.items.default ?? "";
            }
          }

          let defaultValue: unknown = unparsedDefaultValue;
          try {
            // For objects & arrays the default value / example values should be
            // serialized values, so we attempt to deserialize them before use.
            if (
              input.schema.type === "object" ||
              input.schema.type === "array"
            ) {
              if (defaultValue !== "") {
                try {
                  defaultValue = JSON.parse(unparsedDefaultValue);
                } catch (err) {
                  defaultValue = null;
                }
              } else {
                defaultValue = null;
              }

              if (isLLMContentBehavior(input.schema)) {
                try {
                  assertIsLLMContent(defaultValue);
                } catch (err) {
                  defaultValue = null;
                }
              }

              if (isLLMContentArrayBehavior(input.schema)) {
                try {
                  assertIsLLMContentArray(defaultValue);
                } catch (err) {
                  defaultValue = null;
                }
              }
            }
          } catch (err) {
            console.warn(`Unable to parse default value for "${input.name}"`);
            console.warn("Value provided", unparsedDefaultValue);
            console.warn(err);
          }

          const id = this.#createId(input.name);
          if (
            // TODO(aomarks) Once all inputs are converted to the plugin system,
            // we simply render delegating-input and let it figure it all out.
            isGoogleDriveFileId(input.schema) ||
            isGoogleDriveQuery(input.schema)
          ) {
            const value = normalizeValue(input);
            inputField = html`<bb-delegating-input
              id=${id}
              .schema=${input.schema}
              .value=${value ?? defaultValue}
            ></bb-delegating-input>`;
          } else if (isBoardBehavior(input.schema)) {
            inputField = createBoardInput(
              id,
              input.value as UnresolvedPathBoardCapability
            );
          } else if (isModuleBehavior(input.schema)) {
            const modules = Object.entries(this.graph?.modules ?? {}).filter(
              ([, module]) => module.metadata?.runnable
            );

            modules.unshift([
              NO_MODULE,
              {
                code: "// No module",
                metadata: { description: "Unsets this module value" },
              },
            ]);

            inputField = html`<div class="module-selector">
                ${map(modules, ([module, moduleInfo], idx) => {
                  const description =
                    moduleInfo.metadata?.description || "No description";

                  return html`
                    <div class="module">
                      <input
                        type="radio"
                        name=${id}
                        id="${id}-${idx}"
                        .value=${module === NO_MODULE ? "" : module}
                        ?checked=${(module === NO_MODULE && !input.value) ||
                        module === input.value}
                      />
                      <label for="${id}-${idx}">
                        <span class="module-title"
                          >${moduleInfo.metadata?.title ?? module}</span
                        >
                        <span class="module-description">${description}</span>
                        ${module === NO_MODULE
                          ? nothing
                          : html`<button
                              class="jump-to-definition"
                              @pointerover=${(evt: PointerEvent) => {
                                this.dispatchEvent(
                                  new ShowTooltipEvent(
                                    "Jump to module definition",
                                    evt.clientX,
                                    evt.clientY
                                  )
                                );
                              }}
                              @pointerout=${() => {
                                this.dispatchEvent(new HideTooltipEvent());
                              }}
                              @click=${() => {
                                const selections =
                                  Utils.Workspace.createEmptyWorkspaceSelectionState();
                                selections.modules.add(module);

                                const changeId =
                                  Utils.Workspace.createWorkspaceSelectionChangeId();
                                this.dispatchEvent(new HideTooltipEvent());
                                this.dispatchEvent(
                                  new WorkspaceSelectionStateEvent(
                                    changeId,
                                    selections,
                                    true
                                  )
                                );
                              }}
                            >
                              Jump to definition
                            </button>`}
                      </label>
                    </div>
                  `;
                })}
              </div>

              <button
                class="create-new-module"
                @click=${() => {
                  const moduleId = getModuleId();
                  if (!moduleId) {
                    return;
                  }

                  this.dispatchEvent(new ModuleCreateEvent(moduleId));
                }}
              >
                Create a new module...
              </button> `;
          } else {
            switch (input.schema.type) {
              case "array": {
                if (isLLMContentArrayBehavior(input.schema)) {
                  let value: LLMContent[] | null =
                    (input.value as LLMContent[]) ?? null;
                  // First, check to see if the default value is available and
                  // use that if the value is not set.
                  if (!value && isLLMContentArray(defaultValue)) {
                    value = defaultValue;
                  }
                  // Finally, if there is no default value, set the value to an
                  // array consisting of a single empty LLMContent.
                  if (!value || value.length === 0) {
                    value = [{ role: "user", parts: [] }];
                  }

                  const allow = createAllowListFromProperty(input.schema);
                  const minItems = getMinItemsFromProperty(input.schema);

                  inputField = html`<bb-llm-input-array
                    id="${id}"
                    name="${id}"
                    .description=${input.schema.description || null}
                    .useChatInput=${this.useChatInput}
                    .useDebugChatInput=${this.useDebugChatInput}
                    .values=${value}
                    .allow=${allow}
                    .minItems=${minItems}
                    .clamped=${this.llmInputClamped}
                    .inlineControls=${this.inlineControls}
                    .showEntrySelector=${this.llmInputShowEntrySelector}
                    .nodeId=${this.nodeId}
                    .subGraphId=${this.subGraphId}
                    .autofocus=${true}
                    .projectState=${this.projectState}
                    .streamlined=${this.llmInputStreamlined}
                    .showPartControls=${this.llmInputShowPartControls}
                    .showInlineControlsToggle=${this
                      .llmShowInlineControlsToggle}
                    .chatAudioWaveColor=${this.chatAudioWaveColor}
                  ></bb-llm-input-array>`;
                } else {
                  let renderableValue: unknown = input.value;
                  if (typeof input.value !== "string") {
                    renderableValue = JSON.stringify(input.value);
                  }

                  let items: Array<string | number | object> | null = null;
                  try {
                    items = JSON.parse(renderableValue as string);
                  } catch (err) {
                    items = null;
                  }

                  inputField = html`<bb-array-editor
                    id="${id}"
                    name="${id}"
                    .items=${items}
                    .type=${resolveArrayType(input.schema)}
                    .behavior=${resolveBehaviorType(
                      input.schema.items
                        ? Array.isArray(input.schema.items)
                          ? input.schema.items[0]
                          : input.schema.items
                        : input.schema
                    )}
                    .graph=${this.graph}
                    .boardServers=${this.boardServers}
                  ></bb-array-editor>`;
                }
                break;
              }

              case "object": {
                if (isPortSpecBehavior(input.schema)) {
                  if (typeof input.value === "string") {
                    try {
                      input.value = JSON.parse(input.value);
                    } catch (err) {
                      console.warn(`Unable to convert value`);
                    }
                  }

                  inputField = html`<bb-streamlined-schema-editor
                    id=${id}
                    name=${id}
                    .nodeId=${input.name}
                    .schema=${input.value}
                    .schemaVersion=${0}
                  ></bb-streamlined-schema-editor>`;
                  break;
                } else if (isLLMContentBehavior(input.schema)) {
                  if (!isLLMContent(input.value)) {
                    input.value = undefined;
                  }

                  if (this.useChatInput) {
                    inputField = html`<bb-llm-input-chat
                      id="${id}"
                      name="${id}"
                      .schema=${input.schema}
                      .value=${input.value ?? defaultValue ?? null}
                      .description=${input.schema.description || null}
                      .clamped=${this.llmInputClamped}
                      .nodeId=${this.nodeId}
                      .subGraphId=${this.subGraphId}
                      .projectState=${this.projectState}
                      .showChatContinueButton=${this.showChatContinueButton}
                      .audioWaveColor=${this.chatAudioWaveColor}
                    ></bb-llm-input-chat>`;
                    break;
                  }

                  if (this.useDebugChatInput) {
                    inputField = html`<bb-llm-input-chat-debug
                      id="${id}"
                      name="${id}"
                      .schema=${input.schema}
                      .value=${input.value ?? defaultValue ?? null}
                      .description=${input.schema.description || null}
                      .clamped=${this.llmInputClamped}
                      .nodeId=${this.nodeId}
                      .subGraphId=${this.subGraphId}
                      .projectState=${this.projectState}
                      .showChatContinueButton=${this.showChatContinueButton}
                    ></bb-llm-input-chat-debug>`;
                    break;
                  }

                  inputField = html`<bb-llm-input
                    id="${id}"
                    name="${id}"
                    .schema=${input.schema}
                    .value=${input.value ?? defaultValue ?? null}
                    .description=${input.schema.description || null}
                    .clamped=${this.llmInputClamped}
                    .inlineControls=${this.inlineControls}
                    .nodeId=${this.nodeId}
                    .subGraphId=${this.subGraphId}
                    .projectState=${this.projectState}
                    .singleLine=${isSingleLineBehavior(input.schema)}
                    .streamlined=${this.llmInputStreamlined}
                    .showPartControls=${this.llmInputShowPartControls}
                    .showInlineControlsToggle=${this
                      .llmShowInlineControlsToggle}
                  ></bb-llm-input>`;
                  break;
                } else if (isBoardBehavior(input.schema)) {
                  inputField = createBoardInput(
                    id,
                    input.value as UnresolvedPathBoardCapability
                  );
                  break;
                }

                inputField = html`<textarea
                  @blur=${(evt: Event) => {
                    if (!(evt.target instanceof HTMLTextAreaElement)) {
                      return;
                    }

                    try {
                      if (!evt.target.value) {
                        return;
                      }

                      JSON.parse(evt.target.value);
                    } catch (err) {
                      evt.target.setCustomValidity("Please enter valid JSON");
                      evt.target.reportValidity();
                    }
                  }}
                  @input=${(evt: Event) => {
                    if (!(evt.target instanceof HTMLTextAreaElement)) {
                      return;
                    }

                    evt.target.setCustomValidity("");
                    try {
                      if (!evt.target.value) {
                        return;
                      }

                      JSON.parse(evt.target.value);
                    } catch (err) {
                      evt.stopImmediatePropagation();
                    }
                  }}
                  id=${id}
                  name=${id}
                  autocomplete="off"
                  placeholder=${input.schema.description ?? ""}
                  .value=${stringifyObject(input.value, defaultValue)}
                ></textarea>`;
                break;
              }

              case "number": {
                inputField = html`<input
                  type="number"
                  id=${id}
                  name=${id}
                  autocomplete="off"
                  placeholder=${input.schema.description ?? ""}
                  ?required=${input.required}
                  .value=${input.value ?? defaultValue ?? ""}
                />`;
                break;
              }

              case "boolean": {
                inputField = html`<input
                  type="checkbox"
                  id=${id}
                  name=${id}
                  autocomplete="off"
                  .checked=${input.value}
                />`;
                break;
              }

              case "string":
              default: {
                if (isCodeBehavior(input.schema)) {
                  inputField = html`<bb-code-editor
                    id=${id}
                    name=${id}
                    .language=${"javascript"}
                    .value=${input.value ?? defaultValue ?? ""}
                  ></bb-code-editor>`;
                  break;
                }

                if (isEnum(input.schema)) {
                  const options = isEnum(input.schema)
                    ? input.schema.enum || []
                    : input.schema.examples || [];

                  const selectValue = input.value ?? defaultValue ?? "";

                  inputField = html`<select
                    id=${id}
                    name=${id}
                    autocomplete="off"
                    placeholder=${input.schema.description ?? ""}
                  >
                    ${options.map(
                      (item) =>
                        html`<option ?selected=${item === selectValue}>
                          ${item}
                        </option>`
                    )}
                  </select>`;

                  break;
                }

                const hasExamples =
                  input.schema.examples && input.schema.examples.length;
                let presetList: HTMLTemplateResult | symbol = nothing;
                if (hasExamples) {
                  presetList = html`<datalist id=${`${id}-presets`}>
                    ${input.schema.examples!.map((item) => {
                      return html`<option value="${item}"></option>`;
                    })}
                  </datalist>`;
                }

                if (
                  input.schema.format === "multiline" ||
                  input.schema.format === "markdown"
                ) {
                  if (hasExamples) {
                    inputField = html`${presetList}<input
                        type="text"
                        list=${`${id}-presets`}
                        id=${id}
                        name=${id}
                        autocomplete="off"
                        placeholder=${input.schema.description ?? ""}
                        .value=${input.value ?? defaultValue ?? ""}
                      />`;
                    break;
                  }

                  inputField = html`<textarea
                    id=${id}
                    name=${id}
                    autocomplete="off"
                    placeholder=${input.schema.description ?? ""}
                    .value=${input.value ?? defaultValue ?? ""}
                  ></textarea>`;
                  break;
                }

                inputField = html`${presetList}<input
                    .type=${input.secret ? "password" : "text"}
                    list=${hasExamples ? `${id}-presets` : nothing}
                    id=${id}
                    name=${id}
                    autocomplete="off"
                    placeholder=${input.schema.description ?? ""}
                    ?required=${input.required}
                    .value=${input.value ?? defaultValue ?? ""}
                  />`;
                break;
              }
            }
          }
        }

        const styles: Record<string, boolean> = {
          item: true,
          configured: input.configured ?? false,
        };

        if (input.status) {
          styles["status"] = true;
          styles[input.status] = true;
        }

        let typeInfo: HTMLTemplateResult | symbol = nothing;
        if (this.showTypes) {
          let typeString = "(unspecified)";
          if (input.type) {
            switch (input.type) {
              case "array": {
                typeString = "array";
                if (Array.isArray(input.schema?.items)) {
                  break;
                }

                const behavior = Array.isArray(input.schema?.items?.behavior)
                  ? ` [input.schema?.items?.behavior.join(", ")]`
                  : "";
                typeString = `array${behavior}`;
                break;
              }

              case "object": {
                const behavior = Array.isArray(input.schema?.behavior)
                  ? ` [${input.schema?.behavior.join(", ")}]`
                  : "";
                typeString = `object${behavior}`;
                break;
              }

              default:
                typeString = Array.isArray(input.type)
                  ? input.type.join(", ")
                  : input.type;
                break;
            }
          }

          typeInfo = html`<span class="type">(${typeString})</span>`;
        }

        const id = this.#createId(input.name);
        const reset = html`<button
          class=${classMap({
            reset: true,
            visible:
              input.originalValue !== null && input.originalValue !== undefined,
          })}
          id=${`${id}-reset`}
          @click=${() => {
            this.dispatchEvent(new EnhanceNodeResetEvent(input.name));
          }}
        >
          Reset
        </button>`;

        const enhance =
          input.offer && input.offer.enhance
            ? html`
                <button
                  class=${classMap({
                    enhance: true,
                    active: this.enhancingInput.has(input.name),
                  })}
                  ?disabled=${this.enhancingInput.has(input.name)}
                  @click=${() => {
                    if (!this.nodeId) {
                      return;
                    }

                    this.enhancingInput.add(input.name);
                    this.requestUpdate();

                    this.dispatchEvent(
                      new EnhanceNodeConfigurationEvent(
                        this.nodeId,
                        input.name,
                        input.value
                      )
                    );
                  }}
                >
                  Enhance
                </button>
              `
            : nothing;

        return html`<div
          id=${this.#createId(`container-${input.name}`)}
          class=${classMap(styles)}
        >
          ${input.secret
            ? html`<p class="api-message">
                When calling an API, the API provider's applicable privacy
                policy and terms apply
              </p>`
            : nothing}
          ${this.showTitleInfo && input.title !== ""
            ? html`<span class="title">
                <span class="title-value">${input.title} ${typeInfo}</span>
                ${reset} ${enhance}
              </span>`
            : html`${reset} ${enhance}`}
          <label
            @keydown=${(evt: KeyboardEvent) => {
              if (!(evt.target instanceof HTMLElement)) {
                return;
              }

              if (evt.key !== "Space" && evt.key !== "Enter") {
                return;
              }

              evt.target.click();
            }}
            tabindex=${input.schema?.type === "boolean" ? "0" : nothing}
            for="${this.#createId(input.name)}"
            >${description}</label
          >
          <div class="input">${inputField}</div>
        </div>`;
      })}
    </form> `;
  }
}

function stringifyObject(o: unknown, defaultValue?: unknown): string {
  if (o) {
    if (typeof o === "string") {
      return o;
    }
    return JSON.stringify(o, null, 2);
  } else {
    if (defaultValue) {
      return stringifyObject(defaultValue);
    } else {
      return "";
    }
  }
}

function normalizeValue(input: UserInputConfiguration) {
  if (!input.value) return input.value;
  if (input.schema?.type === "object") {
    if (typeof input.value === "string")
      try {
        return JSON.parse(input.value as string);
      } catch (e) {
        return input.value;
      }
  }
  return input.value;
}
