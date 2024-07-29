/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { UserInputConfiguration, UserOutputValues } from "../../types/types";
import { map } from "lit/directives/map.js";
import {
  isArrayOfLLMContentBehavior,
  isBoardBehavior,
  isCodeBehavior,
  isGoogleDriveFileId,
  isGoogleDriveQuery,
  isLLMContentBehavior,
  isPortSpecBehavior,
} from "../../utils/index.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { CodeEditor, LLMInput, LLMInputArray } from "../elements";
import {
  GraphDescriptor,
  GraphProvider,
  isLLMContent,
  LLMContent,
  NodeValue,
} from "@google-labs/breadboard";
import {
  assertIsLLMContent,
  resolveArrayType,
  resolveBehaviorType,
} from "../../utils/schema";
import {
  createAllowListFromProperty,
  getMinItemsFromProperty,
} from "../../utils/llm-content";
import { UserOutputEvent } from "../../events/events";

@customElement("bb-user-input")
export class UserInput extends LitElement {
  @property()
  inputs: UserInputConfiguration[] = [];

  @property()
  showTypes = false;

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

    .item.status.connected .title::before {
      background: var(--bb-inputs-300);
    }

    .item.status.connected.configured .title::before {
      background: var(--bb-boards-500);
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
  `;

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
                isArrayOfLLMContentBehavior(input.schema) ||
                isBoardBehavior(input.schema, inputValue)
              ) {
                if (isArrayOfLLMContentBehavior(input.schema)) {
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
    return name.replace(/^\$/, "__");
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
            !isArrayOfLLMContentBehavior(input.schema)
          ) {
            description = html`<span class="description"
              >${input.schema.description}</span
            >`;
          }

          const unparsedDefaultValue =
            input.schema.examples && input.schema.examples.length > 0
              ? input.schema.examples[0]
              : typeof input.schema.default === "string"
                ? input.schema.default
                : "";

          let defaultValue: unknown = unparsedDefaultValue;
          try {
            // For objects & arrays the default value / example values should be
            // serialized values, so we attempt to deserialize them before use.
            if (
              input.schema.type === "object" ||
              input.schema.type === "array"
            ) {
              if (defaultValue !== "") {
                defaultValue = JSON.parse(unparsedDefaultValue);
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
          switch (input.schema.type) {
            case "array": {
              if (isArrayOfLLMContentBehavior(input.schema)) {
                let value: LLMContent[] | null =
                  (input.value as LLMContent[]) ?? null;
                if (!value) {
                  const unparsedValue = input.schema.default;
                  value = unparsedValue
                    ? JSON.parse(unparsedValue)
                    : [{ parts: [], role: "user" }];
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
                inputField = html`<bb-schema-editor
                  id=${id}
                  name=${id}
                  .nodeId=${input.name}
                  .schema=${input.value}
                  .schemaVersion=${0}
                ></bb-schema-editor>`;
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
              if (isGoogleDriveFileId(input.schema)) {
                inputField = html`<bb-google-drive-file-id
                  id=${id}
                  .value=${input.value ?? defaultValue ?? ""}
                ></bb-google-drive-file-id>`;
                break;
              }
              if (isGoogleDriveQuery(input.schema)) {
                inputField = html`<bb-google-drive-query
                  id=${id}
                  .value=${input.value ?? defaultValue ?? ""}
                ></bb-google-drive-query>`;
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

        return html`<div class=${classMap(styles)}>
          <label>
            <span class="title">${input.title} ${typeInfo}</span>
            ${description}
          </label>
          ${inputField}
        </div>`;
      })}
    </form> `;
  }
}
