/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "@google-labs/breadboard";
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
              .behavior=${resolveBehaviorType(value)}
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

      let format: HTMLTemplateResult | symbol = nothing;
      switch (value.type) {
        case "string":
        case "array": {
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
            <option ?selected=${value.type === "image/png"} value="image/png">
              Image
            </option>
            <option ?selected=${value.type === "audio/ogg"} value="audio/ogg">
              Audio
            </option>
          </select>

          ${format} ${value.type === "string" ? enumerations : nothing}
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
        const inFormat = form.querySelector(
          `#${id}-format`
        ) as HTMLInputElement | null;
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

        property.title = inTitle?.value || property.title;
        property.type = inType?.value || property.type;
        property.description = inDescription?.value || property.description;
        property.examples = JSON.parse(inExamples?.value || "[]") as string[];

        const userChoices = JSON.parse(inEnum?.value || "[]") as string[];

        if (inFormat && inFormat.value !== "none") {
          property.format = inFormat.value;
        } else {
          delete property.format;
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
