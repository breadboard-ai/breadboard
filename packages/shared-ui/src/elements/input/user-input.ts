/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LLMContent } from "@breadboard-ai/types";
import {
  GraphDescriptor,
  GraphProvider,
  isLLMContent,
  isLLMContentArray,
  NodeValue,
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
import { UserOutputEvent } from "../../events/events";
import { UserInputConfiguration, UserOutputValues } from "../../types/types";
import {
  isBoardBehavior,
  isCodeBehavior,
  isEnum,
  isGoogleDriveFileId,
  isGoogleDriveQuery,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
  isPortSpecBehavior,
  isSelect,
} from "../../utils/index.js";
import {
  createAllowListFromProperty,
  getMinItemsFromProperty,
} from "../../utils/llm-content";
import {
  assertIsLLMContent,
  resolveArrayType,
  resolveBehaviorType,
} from "../../utils/schema";
import {
  CodeEditor,
  LLMInput,
  LLMInputArray,
  StreamlinedSchemaEditor,
} from "../elements";
import "./delegating-input.js";

@customElement("bb-user-input")
export class UserInput extends LitElement {
  @property()
  inputs: UserInputConfiguration[] = [];

  @property()
  showTitleInfo = true;

  @property()
  jumpTo: string | null = null;

  @property()
  showTypes = false;

  @property({ reflect: true })
  inlineControls = false;

  @property({ reflect: true })
  llmInputClamped = false;

  @property()
  llmInputShowEntrySelector = true;

  @property()
  graph: GraphDescriptor | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  providers: GraphProvider[] = [];

  @property()
  providerOps = 0;

  #formRef: Ref<HTMLFormElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    .item {
      scroll-margin-top: var(--bb-grid-size-2);
      color: var(--bb-neutral-900);
      margin-bottom: var(--bb-grid-size-2);
    }

    .item label > * {
      display: block;
    }

    .item label .title {
      display: flex;
      align-items: center;
      font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    .item label .title .type {
      font: italic 400 var(--bb-label-medium) /
        var(--bb-label-line-height-medium) var(--bb-font-family);
      color: var(--bb-neutral-600);
      margin-left: var(--bb-grid-size);
    }

    .item label .description {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: 0 0 var(--bb-grid-size-2) 0;
    }

    .item.status .title::before {
      content: "";
      width: var(--bb-grid-size-2);
      height: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-500);
      background: rgb(255, 255, 255);
      margin-right: var(--bb-grid-size-2);
      border-radius: 50%;
      box-sizing: border-box;
    }

    .item.status.connected.configured .title::before,
    .item.status.connected .title::before {
      background: var(--bb-ui-300);
      border: 1px solid var(--bb-ui-600);
    }

    .item.status.missing .title::before {
      background: var(--bb-warning-300);
      border: 1px solid var(--bb-warning-700);
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
      background: rgb(255, 255, 255);
      padding: var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);

      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
    }

    .item textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    .api-message {
      color: var(--bb-neutral-800);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: 0 0 var(--bb-grid-size-2) 0;
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

  processData(showValidationErrors = false) {
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
        const el = this.#formRef.value?.querySelector<HTMLInputElement>(
          `#${id}`
        );
        if (!el) {
          console.warn(`Unable to locate element for #${id} (${input.name})`);
          return { name: input.name, value: null };
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
                isBoardBehavior(input.schema, inputValue)
              ) {
                if (isLLMContentArrayBehavior(input.schema)) {
                  (el as unknown as LLMInputArray).processAllOpenParts();
                } else if (isLLMContentBehavior(input.schema)) {
                  (el as unknown as LLMInput).processAllOpenParts();
                }
                break;
              }

              // The ArrayEditor returns a JSON serialized string for its value
              // so we decode that here.
              try {
                if (inputValue !== "") {
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
    const outputs = this.processData();
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

  render() {
    return html`<form
      ${ref(this.#formRef)}
      @input=${() => {
        this.#emitProcessedData();
      }}
      @bbcodechange=${this.#emitProcessedData}
      @submit=${this.#onFormSubmit}
    >
      ${map(this.inputs, (input, idx) => {
        let inputField: HTMLTemplateResult | symbol = nothing;
        let description: HTMLTemplateResult | symbol = nothing;

        if (input.schema) {
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
            inputField = html`<bb-delegating-input
              id=${id}
              .schema=${input.schema}
              .value=${input.value ?? defaultValue}
            ></bb-delegating-input>`;
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
                    .values=${value}
                    .allow=${allow}
                    .minItems=${minItems}
                    .clamped=${this.llmInputClamped}
                    .inlineControls=${this.inlineControls}
                    .showEntrySelector=${this.llmInputShowEntrySelector}
                  ></bb-llm-input-array>`;
                } else {
                  let renderableValue = input.value;
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
                    .providers=${this.providers}
                    .providerOps=${this.providerOps}
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

                  inputField = html`<bb-llm-input
                    id="${id}"
                    name="${id}"
                    .schema=${input.schema}
                    .value=${input.value ?? defaultValue ?? null}
                    .description=${input.schema.description || null}
                    .clamped=${this.llmInputClamped}
                    .inlineControls=${this.inlineControls}
                  ></bb-llm-input>`;
                  break;
                } else if (isBoardBehavior(input.schema, input.value)) {
                  const board =
                    (typeof input.value === "string"
                      ? input.value
                      : input.value?.path) ?? "";
                  inputField = html`<bb-board-selector
                    id="${id}"
                    name="${id}"
                    .graph=${this.graph}
                    .subGraphs=${this.graph?.graphs ?? null}
                    .providers=${this.providers}
                    .providerOps=${this.providerOps}
                    .value=${board}
                    }
                  ></bb-board-selector>`;
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
                  .autofocus=${idx === 0 ? true : false}
                  .value=${input.value ?? defaultValue ?? ""}
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
                  .autofocus=${idx === 0 ? true : false}
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
                  .autofocus=${idx === 0 ? true : false}
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
                    .value=${input.value ?? defaultValue ?? ""}
                  ></bb-code-editor>`;
                  break;
                }

                if (isSelect(input.schema)) {
                  const options = isEnum(input.schema)
                    ? input.schema.enum || []
                    : input.schema.examples || [];

                  const selectValue = input.value ?? defaultValue ?? "";

                  inputField = html`<select
                    id=${id}
                    name=${id}
                    autocomplete="off"
                    placeholder=${input.schema.description ?? ""}
                    .autofocus=${idx === 0 ? true : false}
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
                if (
                  input.schema.format === "multiline" ||
                  input.schema.format === "markdown"
                ) {
                  inputField = html`<textarea
                    id=${id}
                    name=${id}
                    autocomplete="off"
                    placeholder=${input.schema.description ?? ""}
                    .autofocus=${idx === 0 ? true : false}
                    .value=${input.value ?? defaultValue ?? ""}
                  ></textarea>`;
                  break;
                }

                inputField = html`<input
                  .type=${input.secret ? "password" : "text"}
                  id=${id}
                  name=${id}
                  autocomplete="off"
                  placeholder=${input.schema.description ?? ""}
                  ?required=${input.required}
                  .autofocus=${idx === 0 ? true : false}
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

        return html`<div
          id=${this.#createId(`container-${input.name}`)}
          class=${classMap(styles)}
        >
          <label>
            ${input.secret
              ? html`<p class="api-message">
                  When calling an API, the API provider's applicable privacy
                  policy and terms apply
                </p>`
              : nothing}
            ${this.showTitleInfo
              ? html`<span class="title">${input.title} ${typeInfo}</span>`
              : nothing}
            ${description}
          </label>
          ${inputField}
        </div>`;
      })}
    </form> `;
  }
}
