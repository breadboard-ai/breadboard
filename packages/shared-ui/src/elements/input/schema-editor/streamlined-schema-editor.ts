/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LLMContent } from "@breadboard-ai/types";
import { Schema } from "@google-labs/breadboard";
import {
  css,
  html,
  HTMLTemplateResult,
  LitElement,
  nothing,
  PropertyValues,
} from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { HideTooltipEvent, ShowTooltipEvent } from "../../../events/events";
import { isLLMContentArrayBehavior, isTextBehavior } from "../../../utils";
import {
  createAllowListFromProperty,
  getMinItemsFromProperty,
} from "../../../utils/llm-content";
import { CodeEditor } from "../code-editor/code-editor";
import { assertIsLLMContentArray } from "../../../utils/schema";

const LLM_CONTENT_ARRAY: Schema = {
  type: "array",
  title: "Context",
  items: {
    type: "object",
    examples: [],
    behavior: ["llm-content"],
    default: '[{"role":"user","parts":[{"text":""}]}]',
  },
};

const MARKDOWN_TEXT: Schema = {
  type: "string",
  title: "Text",
  format: "markdown",
};

@customElement("bb-streamlined-schema-editor")
export class StreamlinedSchemaEditor extends LitElement {
  @property()
  nodeId: string | null = null;

  @property()
  schema: Schema | null = null;

  @property()
  showAsCustom = new Set<string>();

  #formRef: Ref<HTMLFormElement> = createRef();
  #schemaPropertiesOrder: string[] = [];

  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      overflow: auto;
    }

    form {
      max-width: 100%;
      overflow: auto;
      display: grid;
      grid-template-columns: 90px minmax(0, 1fr);
      column-gap: var(--bb-grid-size-4);
      row-gap: var(--bb-grid-size-2);
    }

    .delete-property {
      display: grid;
      grid-column: 1/3;
      grid-template-columns: 90px 1fr;
      column-gap: var(--bb-grid-size-4);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    .delete-property-container {
      grid-column: 2;
      align-self: end;
      width: auto;
      display: flex;
      justify-content: flex-end;
      container: size;
    }

    .delete-property-container button {
      height: var(--bb-grid-size-7);
      width: var(--bb-grid-size-7);
      border-radius: 50%;
      background: var(--bb-neutral-100) var(--bb-icon-delete) center center /
        20px 20px no-repeat;
      border: 1px solid var(--bb-neutral-400);
      font-size: 0;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
      opacity: 0.6;
      pointer-events: auto;
    }

    .delete-property-container button:hover,
    .delete-property-container button:focus {
      opacity: 1;
      background-color: var(--bb-warning-100);
      border: 1px solid var(--bb-warning-300);
    }

    .input-type {
      display: grid;
      grid-template-rows: 28px;
      row-gap: 8px;
      container: size;
    }

    @container (min-width: 500px) {
      .input-type {
        grid-template-columns: min-content min-content min-content;
        column-gap: 8px;
      }

      .delete-property-container {
        height: 0;
        margin-bottom: calc(var(--bb-grid-size-3) * -1);
        z-index: 1;
        pointer-events: none;
      }
    }

    .input-type label {
      height: var(--bb-grid-size-7);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-7);
      color: var(--bb-neutral-800);
      border: 1px solid var(--bb-neutral-400);
      background: var(--bb-neutral-0);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--bb-grid-size-2);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
      opacity: 0.6;
      white-space: nowrap;
    }

    .input-type label.llm-content-array {
      background: var(--bb-icon-library-add) 4px center / 20px 20px no-repeat;
    }

    .input-type label.text {
      background: var(--bb-icon-add-text) 4px center / 20px 20px no-repeat;
    }

    .input-type label.custom {
      background: var(--bb-icon-edit) 4px center / 20px 20px no-repeat;
    }

    .input-type input {
      display: none;
    }

    .input-type label:hover {
      opacity: 0.9;
    }

    .input-type input:checked + label {
      color: var(--bb-ui-600);
      border: 1px solid var(--bb-ui-300);
      background: var(--bb-ui-50);
      opacity: 1;
    }

    .input-type input:checked + label.llm-content-array {
      background: var(--bb-ui-50) var(--bb-icon-library-add-ui) 4px center /
        20px 20px no-repeat;
    }

    .input-type input:checked + label.text {
      background: var(--bb-ui-50) var(--bb-icon-add-text-ui) 4px center / 20px
        20px no-repeat;
    }

    .input-type input:checked + label.custom {
      background: var(--bb-ui-50) var(--bb-icon-edit-ui) 4px center / 20px 20px
        no-repeat;
    }

    .hint {
      grid-column: 2 / 3;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-2);
    }

    .hint em {
      font-weight: 600;
      font-style: normal;
    }

    .hint a {
      color: var(--bb-ui-500);
    }

    .divider {
      padding-top: var(--bb-grid-size-2);
      margin-top: var(--bb-grid-size-2);
      grid-column: 1 / 3;
      border-top: 1px solid var(--bb-neutral-200);
    }

    #controls {
      grid-column: 2;
      display: flex;
      padding: var(--bb-grid-size-2) 0 var(--bb-grid-size-4) 0;
    }

    .no-schema,
    #controls.no-schema {
      grid-column: 1/3;
      padding-top: 0;
    }

    .no-schema {
      font: 400 italic var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: 0;
      color: var(--bb-neutral-700);
    }

    .schema-editor {
      grid-column: 2;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
    }

    input[type="text"],
    select,
    textarea {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    textarea {
      resize: none;
      field-sizing: content;
      max-height: 300px;
    }

    label {
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      align-self: center;
    }

    #controls button {
      height: var(--bb-grid-size-7);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-7);
      border-radius: 40px;
      background: var(--bb-ui-50);
      border: 1px solid var(--bb-ui-300);
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0, 0, 0.2, 1);
      opacity: 0.6;
      margin-right: var(--bb-grid-size-2);
    }

    #controls button:hover,
    #controls button:focus {
      opacity: 1;
    }

    #controls button#create-schema {
      background: var(--bb-ui-50) var(--bb-icon-add) 4px center / 20px 20px
        no-repeat;
    }

    #controls button#add-schema-item {
      background: var(--bb-ui-50) var(--bb-icon-add) 4px center / 20px 20px
        no-repeat;
    }

    #controls button#delete-schema-items {
      background: var(--bb-neutral-100) var(--bb-icon-delete) 4px center / 20px
        20px no-repeat;
      border: 1px solid var(--bb-neutral-400);
    }

    #controls button#delete-schema-items:hover,
    #controls button#delete-schema-items:focus {
      opacity: 1;
      background-color: var(--bb-warning-100);
      border: 1px solid var(--bb-warning-300);
    }

    #controls button#unset-schema {
      background: var(--bb-ui-50) var(--bb-icon-delete) 4px center / 20px 20px
        no-repeat;
    }
  `;

  get value() {
    return this.schema;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (!changedProperties.has("schema")) {
      return;
    }

    this.showAsCustom.clear();
  }

  #processTypeChange(name: string, type: string) {
    if (!this.schema || !this.schema.properties) {
      return;
    }

    let property = this.schema.properties[name];
    const title = property.title;

    switch (type) {
      case "text":
      case "llm-content-array": {
        if (
          !confirm("This will delete the existing configuration. Are you sure?")
        ) {
          return false;
        }

        this.showAsCustom.delete(name);

        property = structuredClone(
          type === "llm-content-array" ? LLM_CONTENT_ARRAY : MARKDOWN_TEXT
        );
        this.#destroyEditorIfNeeded(name);

        if (title) {
          property.title = title;
        }
        break;
      }

      case "custom": {
        this.showAsCustom.add(name);
        break;
      }
    }

    this.schema.properties[name] = property;
    this.requestUpdate();
    return true;
  }

  #deleteAllSchemaProperties() {
    if (!this.schema) {
      return;
    }

    if (!confirm("Are you sure you want to remove all items?")) {
      return;
    }

    delete this.schema.properties;
    this.requestUpdate();
  }

  #deleteSchemaProperty(name: string) {
    if (!this.schema || !this.schema.properties) {
      return;
    }

    if (!confirm("Are you sure you want to remove this item?")) {
      return;
    }

    this.#schemaPropertiesOrder = this.#schemaPropertiesOrder.filter(
      (item) => item !== name
    );

    delete this.schema.properties[name];
    this.requestUpdate();
  }

  #unsetSchema() {
    this.schema = null;
  }

  #createSchema() {
    this.schema = {
      type: "object",
      properties: {
        prop0: structuredClone(LLM_CONTENT_ARRAY),
      },
      required: [],
    };
  }

  #createNewProperty() {
    if (!this.schema) {
      return;
    }

    if (!this.schema.properties) {
      this.schema.properties = {};
    }

    const propertyNames = new Set(Object.keys(this.schema.properties));
    let idx = propertyNames.size;
    let newPropertyName = `prop-${idx}`;
    while (propertyNames.has(newPropertyName)) {
      idx++;
      newPropertyName = `prop-${idx}`;
    }

    const property = structuredClone(LLM_CONTENT_ARRAY);
    property.title = `Context ${idx + 1}`;
    this.schema.properties[newPropertyName] = property;

    this.requestUpdate();
  }

  #getLLMItem(property: Schema | Schema[] | undefined): LLMContent[] {
    if (typeof property === "object" && !Array.isArray(property)) {
      if (property.items) {
        if (
          typeof property.items === "object" &&
          !Array.isArray(property.items) &&
          property.default
        ) {
          try {
            const defaultValue = JSON.parse(property.default) as LLMContent[];
            assertIsLLMContentArray(defaultValue);
            return defaultValue;
          } catch (err) {
            return [{ parts: [], role: "user" }];
          }
        }
        return [{ parts: [], role: "user" }];
      } else {
        return [{ parts: [], role: "user" }];
      }
    }

    return [{ parts: [], role: "user" }];
  }

  #getEditors() {
    if (!this.#formRef.value) {
      return [];
    }

    return this.#formRef.value.querySelectorAll<CodeEditor>("bb-code-editor");
  }

  destroyEditorsIfNeeded() {
    const editors = this.#getEditors();
    for (const editor of editors) {
      editor.destroy();
    }
  }

  #destroyEditorIfNeeded(id: string) {
    const editors = this.#getEditors();
    for (const editor of editors) {
      if (editor.id !== id) {
        continue;
      }

      editor.destroy();
    }
  }

  reportValidity() {
    if (!this.#formRef.value) {
      return;
    }

    this.#formRef.value.reportValidity();
  }

  checkValidity(): boolean {
    if (!this.#formRef.value) {
      return true;
    }

    const editors = [...this.#getEditors()];
    const codeEditorValidity =
      editors.length > 0
        ? editors.every((editor) => editor.checkValidity())
        : true;

    return this.#formRef.value.checkValidity() && codeEditorValidity;
  }

  #isText(property: Schema) {
    const validProperties = [
      "format",
      "title",
      "type",
      "description",
      "default",
    ];

    return (
      isTextBehavior(property) &&
      Object.keys(property).every((key) => validProperties.includes(key))
    );
  }

  #isLLMContentArray(property: Schema) {
    const validProperties = [
      "items",
      "title",
      "type",
      "description",
      "default",
      "examples",
    ];

    return (
      isLLMContentArrayBehavior(property) &&
      Object.keys(property).every((key) => validProperties.includes(key))
    );
  }

  #updateSchemaValue() {
    if (!this.#formRef.value) {
      return;
    }

    const properties = Object.entries(this.schema?.properties ?? {});
    for (const [name, property] of properties) {
      const id = this.#createId(name);

      // Start by inferring the type from the property.
      let isLLMContentArray = this.#isLLMContentArray(property);
      let isText = this.#isText(property);
      let isCustom = !isLLMContentArray && !isText;

      // If the user has requested an override we use that instead.
      if (this.showAsCustom.has(name)) {
        isLLMContentArray = false;
        isText = false;
        isCustom = true;
      }

      const title = this.#formRef.value.querySelector<HTMLInputElement>(
        `#${id}-title`
      );
      const description = this.#formRef.value.querySelector<HTMLInputElement>(
        `#${id}-description`
      );
      const value = this.#formRef.value.querySelector<HTMLInputElement>(
        `#${id}-value`
      );

      if (isLLMContentArray) {
        if (!title || !description || !value) {
          continue;
        }

        property.title = title.value;
        property.description = description.value;

        if (
          typeof property.items === "object" &&
          !Array.isArray(property.items)
        ) {
          property.default = JSON.stringify(value.value);
        }
      } else if (isText) {
        if (!title || !description || !value) {
          continue;
        }

        property.title = title.value;
        property.description = description.value;
        property.default = value.value;
      } else if (isCustom) {
        if (!value || !this.schema?.properties) {
          continue;
        }

        try {
          const schemaValue = JSON.parse(value.value);
          // TODO: Assert is valid JSON Schema.
          this.schema.properties[name] = schemaValue;
        } catch (err) {
          value.setCustomValidity("Invalid schema");
        }
      } else {
        console.warn("Unable to update schema");
      }

      const existingId = this.#formRef.value.querySelector<HTMLInputElement>(
        `#${id}-existing-property-id`
      );
      const propertyId = this.#formRef.value.querySelector<HTMLInputElement>(
        `#${id}-property-id`
      );

      if (
        this.schema &&
        this.schema.properties &&
        propertyId &&
        existingId &&
        propertyId.value !== existingId.value
      ) {
        const existingPropertyId = this.#createId(existingId.value);
        const property = this.schema.properties[existingPropertyId];
        if (property) {
          const newPropertyId = this.#createId(propertyId.value);
          if (!this.schema.properties[newPropertyId]) {
            this.schema.properties[newPropertyId] = property;
            delete this.schema.properties[existingId.value];

            if (this.showAsCustom.has(existingPropertyId)) {
              this.showAsCustom.delete(existingPropertyId);
              this.showAsCustom.add(newPropertyId);
            }

            // Ensure stable property order by updating the property name in the
            // ordered listing.
            this.#schemaPropertiesOrder = this.#schemaPropertiesOrder.map(
              (property) => {
                if (property === existingPropertyId) {
                  return newPropertyId;
                }

                return property;
              }
            );

            this.requestUpdate();
          } else {
            propertyId.setCustomValidity(
              "A property with this ID already exists"
            );
            propertyId.reportValidity();
          }
        } else {
          console.warn(
            `Unable to locate property with ID ${existingPropertyId}`
          );
        }
      }
    }
  }

  #createId(name: string) {
    return name
      .toLocaleLowerCase()
      .replace(/[\s\W]/gi, "-")
      .replace(/^\$/, "__");
  }

  render() {
    const properties = this.schema?.properties ?? {};

    // The only times these are expected to be unmatched are:
    // 1. We have an entirely new Schema and the current order is unknown.
    // 2. When we traverse the history.
    //
    // In such cases we (re)create the schema property order.
    if (Object.keys(properties).length !== this.#schemaPropertiesOrder.length) {
      this.#schemaPropertiesOrder = Object.keys(properties);
    }

    return html`<form
      ${ref(this.#formRef)}
      @submit=${(evt: Event) => evt.preventDefault()}
      @input=${() => {
        this.#updateSchemaValue();
      }}
    >
      ${this.schema
        ? html`${this.schema.properties
            ? html`${map(this.#schemaPropertiesOrder, (name, idx) => {
                  const property = properties[name];
                  const id = this.#createId(name);
                  let isLLMContentArray = this.#isLLMContentArray(property);
                  let isText = this.#isText(property);
                  let isCustom = !isLLMContentArray && !isText;

                  // If the user has requested an override we use that instead.
                  if (this.showAsCustom.has(name)) {
                    isLLMContentArray = false;
                    isText = false;
                    isCustom = true;
                  }

                  let defaultValueInput: HTMLTemplateResult | symbol =
                    html`TODO`;
                  let hint: HTMLTemplateResult | symbol = nothing;
                  if (isLLMContentArray) {
                    const value = this.#getLLMItem(property);
                    const allow = createAllowListFromProperty(property);
                    const minItems = getMinItemsFromProperty(property);

                    hint = html`
                      A conversation history, typically used with
                      <em>Specialist</em>, <em>Human</em>, or
                      <em>Content</em> components. Each component visited
                      appends its output to this context.
                    `;

                    defaultValueInput = html`<bb-llm-input-array
                      id="${id}-value"
                      name="${id}-value"
                      .values=${value}
                      .allow=${allow}
                      .minItems=${minItems}
                      .clamped=${false}
                      .inlineControls=${true}
                      .showEntrySelector=${false}
                    ></bb-llm-input-array>`;
                  } else if (isText) {
                    hint = html`
                      A simple string value which supports
                      <a href="https://en.wikipedia.org/wiki/Markdown"
                        >Markdown</a
                      >.
                    `;

                    defaultValueInput = html`<textarea
                      name="${id}-value"
                      id="${id}-value"
                      placeholder="Enter a default value for this item"
                      .value=${property.default ?? ""}
                    ></textarea>`;
                  } else {
                    hint = html`Enter a valid schema here`;

                    defaultValueInput = html`<bb-code-editor
                      id="${id}-value"
                      name="${id}-value"
                      class="schema-editor"
                      placeholder="Enter a valid schema for this item"
                      .value=${JSON.stringify(property, null, 2) ?? null}
                      .language=${"json"}
                      @bbcodechange=${(evt: Event) => {
                        if (!(evt.target instanceof CodeEditor)) {
                          return;
                        }
                        // We only want to attempt to parse the value when the
                        // user leaves the field.
                        evt.stopImmediatePropagation();
                        evt.target.setCustomValidity("");
                      }}
                      @blur=${(evt: Event) => {
                        if (!(evt.target instanceof CodeEditor)) {
                          return;
                        }

                        try {
                          JSON.parse(evt.target.value ?? "null");
                          if (!this.#formRef.value) {
                            return;
                          }
                          this.#formRef.value.dispatchEvent(
                            new InputEvent("input")
                          );
                        } catch (err) {
                          // When there is a JSON parse error in an object prevent
                          // the input from propagating further up.
                          evt.target.setCustomValidity(
                            "Please enter a valid object"
                          );
                          evt.target.reportValidity();
                        }
                      }}
                    ></bb-code-editor>`;
                  }

                  return html`<div class="delete-property">
                      <div class="delete-property-container">
                        <button
                          @click=${() => {
                            this.#deleteSchemaProperty(name);
                          }}
                          @pointerover=${(evt: PointerEvent) => {
                            this.dispatchEvent(
                              new ShowTooltipEvent(
                                "Delete item",
                                evt.clientX,
                                evt.clientY
                              )
                            );
                          }}
                          @pointerout=${() => {
                            this.dispatchEvent(new HideTooltipEvent());
                          }}
                        >
                          Remove this item
                        </button>
                      </div>
                    </div>

                    <label>Type</label>
                    <div
                      class="input-type"
                      @click=${(evt: InputEvent) => {
                        if (!(evt.target instanceof HTMLInputElement)) {
                          return;
                        }

                        if (!this.#processTypeChange(id, evt.target.value)) {
                          evt.preventDefault();
                        }
                      }}
                    >
                      <input
                        ?checked=${isLLMContentArray}
                        type="radio"
                        name="${id}-item-type"
                        id="${id}-llm-content-array"
                        value="llm-content-array"
                      />
                      <label
                        class="llm-content-array"
                        for="${id}-llm-content-array"
                        >Conversation Context</label
                      >

                      <input
                        ?checked=${isText}
                        type="radio"
                        name="${id}-item-type"
                        id="${id}-text"
                        value="text"
                      />
                      <label class="text" for="${id}-text">Text</label>

                      <input
                        ?checked=${isCustom}
                        type="radio"
                        name="${id}-item-type"
                        id="${id}-custom"
                        value="custom"
                      />
                      <label class="custom" for="${id}-custom">Custom</label>
                    </div>

                    <aside class="hint">${hint}</aside>

                    <input
                      type="hidden"
                      id=${`${id}-existing-property-id`}
                      .value=${id ?? ""}
                    />

                    <label>ID</label>
                    <input
                      type="text"
                      id="${id}-property-id"
                      @input=${(evt: InputEvent) => {
                        if (!(evt.target instanceof HTMLInputElement)) {
                          return;
                        }
                        evt.target.setCustomValidity("");
                      }}
                      .value=${id ?? ""}
                      required
                      autocomplete="off"
                      pattern="^[a-z0-9\\-_]+$"
                    />

                    ${isLLMContentArray || isText
                      ? html`
                          <label>Title</label>
                          <input
                            id="${id}-title"
                            type="text"
                            placeholder="Enter the title for this item"
                            .value=${property.title}
                          />

                          <label>Description</label>
                          <textarea
                            id="${id}-description"
                            placeholder="Enter a description for this item"
                            .value=${property.description ?? ""}
                          ></textarea>

                          <label>Default</label>
                        `
                      : nothing}
                    ${defaultValueInput}
                    ${idx < this.#schemaPropertiesOrder.length - 1
                      ? html`<div class="divider"></div>`
                      : ``}`;
                })}

                <div id="controls">
                  <button
                    @click=${() => {
                      this.#createNewProperty();
                    }}
                    id="add-schema-item"
                  >
                    Add a new item
                  </button>
                  <button
                    @click=${() => {
                      this.#deleteAllSchemaProperties();
                    }}
                    id="delete-schema-items"
                  >
                    Delete all items
                  </button>
                </div>`
            : html`<p class="no-schema">There are no schema items</p>
                <div id="controls" class="no-schema">
                  <button
                    @click=${() => {
                      this.#createNewProperty();
                    }}
                    id="add-schema-item"
                  >
                    Add a new item
                  </button>
                  <button
                    @click=${() => {
                      this.#unsetSchema();
                    }}
                    id="unset-schema"
                  >
                    Unset schema
                  </button>
                </div>`}`
        : html`<p class="no-schema">(not configured)</p>
            <div id="controls" class="no-schema">
              <button
                @click=${() => {
                  this.#createSchema();
                }}
                id="create-schema"
              >
                Create one
              </button>
            </div>`}
    </form>`;
  }
}
