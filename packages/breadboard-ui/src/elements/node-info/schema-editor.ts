/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BehaviorSchema, Schema } from "@google-labs/breadboard";
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { SchemaChangeEvent } from "../../events/events.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";
import { resolveArrayType, resolveBehaviorType } from "../../utils/schema.js";

@customElement("bb-schema-editor")
export class SchemaEditor extends LitElement {
  @property({ reflect: true })
  editable = false;

  @property()
  schema: Schema | null = {};

  @property()
  schemaVersion = 0;

  static styles = css`
    :host {
      display: block;
    }

    #apply-changes[disabled],
    #add-new-item[disabled] {
      display: none;
    }

    #add-new-item {
      width: 24px;
      height: 24px;
      background: var(--bb-icon-add-circle) center center no-repeat;
      border: none;
      font-size: 0;
      opacity: 0.5;
      cursor: pointer;
    }

    #add-new-item:hover {
      opacity: 1;
    }

    details {
      border: 1px solid #cccccc;
      border-radius: 4px;
      margin: calc(var(--bb-grid-size) * 2) 0;
    }

    summary {
      padding: calc(var(--bb-grid-size) * 2);
      font-weight: bold;
      border-radius: 4px 4px 0 0;
      background: #fafafa;
      display: flex;
      align-items: center;
    }

    summary span {
      flex: 1;
    }

    details .schema-item {
      display: grid;
      align-items: center;
      justify-content: stretch;
      border-top: 1px solid #cccccc;
      grid-template-columns: 100px auto;
      grid-auto-rows: minmax(calc(var(--bb-grid-size) * 5), auto);
      row-gap: var(--bb-grid-size);
      column-gap: var(--bb-grid-size);
      font-size: var(--bb-text-nano);
      padding: calc(var(--bb-grid-size) * 2);
    }

    details .schema-item label {
      line-height: calc(var(--bb-grid-size) * 5);
      align-self: start;
    }

    details .schema-item input[type="checkbox"] {
      justify-self: start;
    }

    details .schema-item input,
    details .schema-item select {
      margin: 0;
      padding: 0;
      font-size: var(--bb-text-nano);
    }

    details .schema-item textarea {
      font-family: var(--bb-font-family);
      font-size: var(--bb-body-small);
      line-height: var(--bb-body-line-height-small);
      resize: none;
      display: block;
      box-sizing: border-box;
      width: 100%;
      field-sizing: content;
      max-height: 300px;
    }

    #controls {
      display: flex;
      justify-content: flex-end;
    }

    .delete-schema-item {
      background: #5e5e5e;
      color: #fff;
      font-size: var(--bb-text-nano);
      border: none;
      border-radius: 4px;
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 2);
    }

    .delete-schema-item {
      background: #666;
    }

    button[disabled] {
      opacity: 0.5;
    }
  `;

  #formRef: Ref<HTMLFormElement> = createRef();

  #convertPropertiesToForms(
    properties: Record<string, Schema>,
    required: string[]
  ) {
    return html`${map(Object.entries(properties), ([id, value]) => {
      const defaultLabel = html` <label for="${id}-default">Default</label>`;
      let defaultValue: HTMLTemplateResult | symbol = nothing;
      let valueType = "string";
      switch (value.type) {
        case "array": {
          valueType = "array";
          defaultValue = html`${defaultLabel}<bb-array-editor
              id="${id}-default"
              name="${id}-default"
              ?readonly=${!this.editable}
              .items=${JSON.parse(value.default || "null")}
              .type=${resolveArrayType(value)}
              .behavior=${resolveBehaviorType(value.items)}
            ></bb-array-editor>`;
          break;
        }

        case "boolean": {
          valueType = "boolean";
          defaultValue = html`${defaultLabel}<input
              type="checkbox"
              id="${id}-default"
              name="${id}-default"
              ?checked="${value.default === "true"}"
              ?readonly=${!this.editable}
            />`;
          break;
        }

        case "number": {
          valueType = "number";
          defaultValue = html`${defaultLabel}<input
              type="number"
              id="${id}-default"
              name="${id}-default"
              value="${value.default}"
              ?readonly=${!this.editable}
            />`;
          break;
        }

        case "string":
        case "object": {
          if (value.enum) {
            defaultValue = html`${defaultLabel}<select
                type="text"
                id="${id}-default"
                name="${id}-default"
                ?readonly=${!this.editable}
              >
                ${map(value.enum, (option) => {
                  return html`<option ?selected=${option === value.default}>
                    ${option}
                  </option>`;
                })}
              </select>`;
          } else {
            defaultValue = html`${defaultLabel}<input
                type="text"
                id="${id}-default"
                name="${id}-default"
                value="${value.default || ""}"
                ?readonly=${!this.editable}
              />`;
          }
          break;
        }
      }

      const enumerations = html`<label for="${id}-enum">User choices</label>
        <bb-array-editor
          id="${id}-enum"
          name="${id}-enum"
          ?readonly=${!this.editable}
          .items=${value.enum || []}
          .type=${"string"}
        ></bb-array-editor>`;

      let itemType: HTMLTemplateResult | symbol = nothing;
      switch (value.type) {
        case "array": {
          const selectedItemType =
            value.items && !Array.isArray(value.items) && value.items.type
              ? value.items.type
              : "none";
          itemType = html`<label for="${id}-items">Array Item Type</label>
            <select
              name="${id}-items"
              id="${id}-items"
              ?readonly=${!this.editable}
            >
              <option value="none">No type</option>
              <option ?selected=${selectedItemType === "object"} value="object">
                Object
              </option>
              <option ?selected=${selectedItemType === "string"} value="string">
                String
              </option>
              <option ?selected=${selectedItemType === "number"} value="number">
                Number
              </option>
              <option
                ?selected=${selectedItemType === "boolean"}
                value="boolean"
              >
                Boolean
              </option>
            </select>`;
          break;
        }
      }

      let behavior: HTMLTemplateResult | symbol = nothing;
      switch (value.type) {
        case "array":
        case "object": {
          // Only show the behavior for object array items.
          let behaviorList = value.behavior || [];
          if (
            value.type === "array" &&
            (!value.items ||
              Array.isArray(value.items) ||
              value.items.type !== "object")
          ) {
            break;
          }

          // If this is an array with behaviors set, set the list to search to
          // be the items one.
          if (
            value.type === "array" &&
            value.items &&
            !Array.isArray(value.items) &&
            value.items.behavior
          ) {
            behaviorList = value.items.behavior;
          }

          behavior = html`<label for="${id}-behavior">Behavior</label>
            <select
              name="${id}-behavior"
              id="${id}-behavior"
              ?readonly=${!this.editable}
            >
              <option value="none">No behavior</option>
              <option
                value="llm-content"
                ?selected=${behaviorList.includes("llm-content")}
              >
                LLM Content
              </option>
              <option value="board" ?selected=${behaviorList.includes("board")}>
                Board
              </option>
              <option
                value="stream"
                ?selected=${behaviorList.includes("stream")}
              >
                Stream
              </option>
              <option
                value="json-schema"
                ?selected=${behaviorList.includes("json-schema")}
              >
                JSON Schema
              </option>
              <option
                value="ports-spec"
                ?selected=${behaviorList.includes("ports-spec")}
              >
                Port Spec
              </option>
              <option value="code" ?selected=${behaviorList.includes("code")}>
                Code
              </option>
            </select>`;
          break;
        }
      }

      let format: HTMLTemplateResult | symbol = nothing;
      switch (value.type) {
        case "string": {
          format = html`<label for="${id}-format">Format</label>
            <select
              name="${id}-format"
              id="${id}-format"
              type="text"
              ?readonly=${!this.editable}
            >
              <option value="none">No format</option>
              <option value="markdown" ?selected=${value.format === "markdown"}>
                Markdown
              </option>
              <option
                value="multiline"
                ?selected=${value.format === "multiline"}
              >
                Multiline
              </option>
            </select>`;
          break;
        }

        case "array":
        case "object": {
          const isLLMObject =
            value.type === "object" && value.behavior?.includes("llm-content");
          const isArrayOfLLMObjects =
            value.type === "array" &&
            value.items !== undefined &&
            !Array.isArray(value.items) &&
            value.items.type === "object" &&
            value.items.behavior?.includes("llm-content");

          if (isLLMObject || isArrayOfLLMObjects) {
            let objectFormat = value.format ? [value.format] : [];
            if (
              isArrayOfLLMObjects &&
              value.items &&
              !Array.isArray(value.items)
            ) {
              objectFormat = value.items.format?.split(",") || [];
            }

            format = html`<label for="${id}-format">Format</label>
              <select
                name="${id}-format"
                id="${id}-format"
                multiple
                ?readonly=${!this.editable}
                @input=${(evt: InputEvent) => {
                  if (!(evt.target instanceof HTMLSelectElement)) {
                    return;
                  }

                  if (
                    evt.target.selectedOptions.length === 0 ||
                    evt.target.selectedOptions[0].value !== "none"
                  ) {
                    return;
                  }

                  for (let i = 1; i < evt.target.options.length; i++) {
                    evt.target.options[i].selected = false;
                  }
                }}
              >
                <option value="none" ?selected=${objectFormat.length === 0}>
                  Any
                </option>
                <option
                  value="audio-file"
                  ?selected=${objectFormat.includes("audio-file")}
                >
                  Audio (File)
                </option>
                <option
                  value="audio-microphone"
                  ?selected=${objectFormat.includes("audio-microphone")}
                >
                  Audio (Microphone)
                </option>
                <option
                  value="video-file"
                  ?selected=${objectFormat.includes("video-file")}
                >
                  Video (File)
                </option>
                <option
                  value="video-webcam"
                  ?selected=${objectFormat.includes("video-webcam")}
                >
                  Video (Webcam)
                </option>
                <option
                  value="image-file"
                  ?selected=${objectFormat.includes("image-file")}
                >
                  Image (File)
                </option>
                <option
                  value="image-webcam"
                  ?selected=${objectFormat.includes("image-webcam")}
                >
                  Image (Webcam)
                </option>
                <option
                  value="image-drawable"
                  ?selected=${objectFormat.includes("image-drawable")}
                >
                  Image (Drawable)
                </option>
                <option
                  value="text-file"
                  ?selected=${objectFormat.includes("text-file")}
                >
                  Text (File)
                </option>
                <option
                  value="text-inline"
                  ?selected=${objectFormat.includes("text-inline")}
                >
                  Text (Inline)
                </option>
              </select>`;
          }
          break;
        }

        case "audio/webm": {
          format = html`<label for="${id}-format">Format</label>
            <select
              name="${id}-format"
              id="${id}-format"
              type="text"
              ?readonly=${!this.editable}
            >
              <option
                value="microphone"
                ?selected=${value.format === "microphone"}
              >
                Microphone
              </option>
            </select>`;
          break;
        }

        case "image/png": {
          format = html`<label for="${id}-format">Format</label>
            <select
              name="${id}-format"
              id="${id}-format"
              type="text"
              ?readonly=${!this.editable}
            >
              <option value="webcam" ?selected=${value.format === "webcam"}>
                Webcam
              </option>
              <option value="drawable" ?selected=${value.format === "drawable"}>
                Drawable Canvas
              </option>
            </select>`;
          break;
        }
      }

      const examples = html`<label for="${id}-examples">Examples</label>
        <bb-array-editor
          id="${id}-examples"
          name="${id}-examples"
          ?readonly=${!this.editable}
          .items=${value.examples || []}
          .type=${value.type}
        ></bb-array-editor>`;

      return html`<details open class=${classMap({ [valueType]: true })}>
        <summary>
          <span>${value.title ?? id}</span>
          <button
            class="delete-schema-item"
            type="button"
            @click=${() => this.#deleteProperty(id)}
            ?disabled=${!this.editable}
          >
            Delete
          </button>
        </summary>
        <div class="schema-item">
          <label for="${id}-id">ID</label>
          <input
            name="${id}-id"
            id="${id}-id"
            type="text"
            pattern="^[\\$0-9A-Za-z\\-]+$"
            value="${id}"
            required="required"
            ?readonly=${!this.editable}
          />

          <label for="${id}-title">Title</label>
          <input
            name="${id}-title"
            id="${id}-title"
            type="text"
            value="${value.title || ""}"
            ?readonly=${!this.editable}
          />

          <label for="${id}-type">Type</label>
          <select
            name="${id}-type"
            id="${id}-type"
            type="text"
            @input=${() => {
              this.dispatchEvent(new SchemaChangeEvent());
            }}
            ?readonly=${!this.editable}
          >
            <option ?selected=${value.type === "object"} value="object">
              Object
            </option>
            <option ?selected=${value.type === "array"} value="array">
              Array
            </option>
            <option ?selected=${value.type === "string"} value="string">
              String
            </option>
            <option ?selected=${value.type === "number"} value="number">
              Number
            </option>
            <option ?selected=${value.type === "boolean"} value="boolean">
              Boolean
            </option>
          </select>

          ${itemType} ${behavior} ${format}
          ${value.type === "string" ? enumerations : nothing}
          ${value.type === "string" || value.type === "number"
            ? examples
            : nothing}
          ${defaultValue}

          <label for="${id}-description">Description</label>
          <textarea
            name="${id}-description"
            id="${id}-description"
            .value="${value.description || ""}"
            ?readonly=${!this.editable}
          ></textarea>

          <label for="${id}-required">Required</label>
          <input
            name="${id}-required"
            id="${id}-required"
            type="checkbox"
            ?checked=${required.includes(id)}
            ?readonly=${!this.editable}
          />
        </div>
      </details> `;
    })}`;
  }

  applyPendingChanges() {
    const schema: Schema = structuredClone(this.schema || {});
    schema.properties = schema.properties || {};

    if (this.#formRef.value) {
      const form = this.#formRef.value;
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const renamedProperties = new Map<string, string>();
      for (const [id, property] of Object.entries(schema.properties)) {
        const inID = form.querySelector(`#${id}-id`) as HTMLInputElement | null;
        const inTitle = form.querySelector(
          `#${id}-title`
        ) as HTMLInputElement | null;
        const inType = form.querySelector(
          `#${id}-type`
        ) as HTMLInputElement | null;
        const inDefault = form.querySelector(
          `#${id}-default`
        ) as HTMLInputElement | null;
        const inExamples = form.querySelector(
          `#${id}-examples`
        ) as HTMLInputElement | null;
        const inItems = form.querySelector(
          `#${id}-items`
        ) as HTMLSelectElement | null;
        const inBehavior = form.querySelector(
          `#${id}-behavior`
        ) as HTMLInputElement | null;
        const inFormat = form.querySelector(
          `#${id}-format`
        ) as HTMLSelectElement | null;
        const inEnum = form.querySelector(
          `#${id}-enum`
        ) as HTMLInputElement | null;
        const inDescription = form.querySelector(
          `#${id}-description`
        ) as HTMLTextAreaElement | null;
        const inRequired = form.querySelector(
          `#${id}-required`
        ) as HTMLInputElement | null;

        const oldType = property.type;
        const oldBehavior = property.behavior;

        property.title = inTitle?.value || property.title;
        property.type = inType?.value || property.type;
        property.description = inDescription?.value || property.description;
        property.examples = JSON.parse(inExamples?.value || "[]") as string[];

        const userChoices = JSON.parse(inEnum?.value || "[]") as string[];

        if (property.type === "object") {
          if (inBehavior && inBehavior.value !== "none") {
            property.behavior = [inBehavior.value as BehaviorSchema];
          } else {
            delete property.behavior;
          }

          if (inFormat && inFormat.value !== "none") {
            if (inFormat.multiple) {
              property.format = [...inFormat.selectedOptions]
                .map((opt) => opt.value)
                .join(",");
            } else {
              property.format = inFormat.value;
            }
          } else {
            delete property.format;
          }
        }

        // Update Array Items.
        if (property.type === "array" && inItems && inItems.value !== "none") {
          if (
            // Items does not exist
            !property.items ||
            // Items exist but the type value is different.
            (!Array.isArray(property.items) &&
              property.items.type !== inItems.value)
          ) {
            property.items = { type: inItems.value };
          }
        } else {
          delete property.items;
        }

        // Update Array Item Behaviors & Formats
        if (property.type === "array") {
          if (property.items && !Array.isArray(property.items)) {
            if (property.items.type === "object") {
              // Set the behavior.
              if (inBehavior && inBehavior.value !== "none") {
                property.items.behavior = [inBehavior.value as BehaviorSchema];
              } else {
                delete property.items.behavior;
              }

              // If the behavior is llm-content acknowledge the format.
              if (
                property.items.behavior &&
                property.items.behavior.includes("llm-content") &&
                inFormat &&
                inFormat.value !== "none"
              ) {
                if (inFormat.multiple) {
                  property.items.format = [...inFormat.selectedOptions]
                    .map((opt) => opt.value)
                    .join(",");
                } else {
                  property.items.format = inFormat.value;
                }
              } else {
                delete property.items.format;
              }
            } else {
              delete property.items.behavior;
            }
          }
        }

        if (inDefault) {
          if (inDefault.type === "checkbox") {
            property.default = inDefault.checked.toString();
          } else {
            property.default = inDefault.value ?? property.default;
          }
        }

        if (
          !property.default ||
          (oldType === "array" && property.default === "null")
        ) {
          delete property.default;
        }

        property.enum =
          userChoices && userChoices.length ? userChoices : undefined;

        if (!property.enum) {
          delete property.enum;
        }

        if (!property.description) {
          delete property.description;
        }

        if (!property.examples) {
          delete property.examples;
        }

        // Going from boolean -> anything else with no default means removing
        // the value entirely.
        if (oldType === "boolean" && property.type !== oldType) {
          delete property.default;
        }

        if (oldType === "array" && property.type !== oldType) {
          delete property.items;
        }

        if (oldType === "object" && property.type !== oldType) {
          delete property.behavior;
        }

        // Moving to an array of objects means removing any top-level format.
        if (
          property.type === "array" &&
          property.items &&
          !Array.isArray(property.items) &&
          property.items.type === "object"
        ) {
          delete property.format;
        }

        // Going from llm-content -> any other behavior means removing the
        // format entirely.
        if (
          oldBehavior &&
          oldBehavior.includes("llm-content") &&
          property.behavior &&
          !property.behavior.includes("llm-content")
        ) {
          delete property.format;
        }

        if (inID && inID.value && inID.value !== id) {
          renamedProperties.set(id, inID.value);
        }

        if (inRequired) {
          schema.required = schema.required || [];
          const required = new Set(schema.required);
          if (inRequired.checked) {
            required.add(id);
          } else {
            required.delete(id);
          }

          // Migrate any required property ID that has changed.
          const newId = renamedProperties.get(id);
          if (newId && required.has(id)) {
            required.delete(id);
            required.add(newId);
          }

          schema.required = [...required];
        }
      }

      for (const [from, to] of renamedProperties) {
        if (schema.properties[to]) {
          console.warn(`Attempted to rename to existing property: "${to}"`);
          continue;
        }

        schema.properties[to] = schema.properties[from];
        delete schema.properties[from];
      }
    }

    if (schema.properties) {
      schema.type = "object";
    }

    this.schema = schema;
    return true;
  }

  #deleteProperty(id: string) {
    if (!confirm(`Are you sure you wish to delete ${id}?`)) {
      return;
    }

    const schema: Schema = structuredClone(this.schema || {});
    schema.properties =
      typeof schema.properties === "object" ? schema.properties : {};

    schema.properties = schema.properties || {};
    delete schema.properties[id];

    this.schema = schema;
    this.dispatchEvent(new SchemaChangeEvent());
  }

  #createEmptyProperty() {
    const schema: Schema = structuredClone(this.schema || {});
    schema.properties =
      typeof schema.properties === "object" ? schema.properties : {};

    const idx = Object.keys(schema.properties).length + 1;
    schema.properties = schema.properties || {};
    schema.properties[`property-${idx}`] = {
      type: "string",
      title: `Property ${idx}`,
    };

    this.schema = schema;
    this.dispatchEvent(new SchemaChangeEvent());
  }

  render() {
    const properties = this.#convertPropertiesToForms(
      this.schema?.properties || {},
      this.schema?.required || []
    );

    return html` <div id="controls">
        <button
          id="add-new-item"
          type="button"
          ?disabled=${!this.editable}
          @click=${this.#createEmptyProperty}
        >
          Add a new item
        </button>
      </div>
      <form
        @submit=${(evt: Event) => {
          evt.preventDefault();
        }}
        ${ref(this.#formRef)}
      >
        ${properties}
      </form>`;
  }
}
