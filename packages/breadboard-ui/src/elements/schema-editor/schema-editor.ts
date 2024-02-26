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

@customElement("bb-schema-editor")
export class SchemaEditor extends LitElement {
  @property({ reflect: true })
  editable = false;

  @property()
  schema: Schema = {};

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
    }

    details .schema-item {
      display: grid;
      align-items: center;
      justify-content: stretch;
      border-top: 1px solid #cccccc;
      grid-template-columns: 100px auto;
      grid-auto-rows: 20px;
      row-gap: var(--bb-grid-size);
      column-gap: var(--bb-grid-size);
      font-size: var(--bb-text-nano);
      padding: calc(var(--bb-grid-size) * 2);
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

    #controls {
      display: flex;
      justify-content: flex-end;
    }

    #controls button {
      background: #5e5e5e;
      color: #fff;
      font-size: var(--bb-text-nano);
      border: none;
      border-radius: 4px;
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 2);
    }
  `;

  #formRef: Ref<HTMLFormElement> = createRef();

  #convertPropertiesToForms(
    properties: Record<string, Schema>,
    required: string[]
  ) {
    return html`${map(Object.entries(properties), ([id, value]) => {
      let defaultValue: HTMLTemplateResult | symbol = nothing;
      let valueType = "string";
      switch (value.type) {
        case "array": {
          valueType = "array";
          defaultValue = html`<input
            type="text"
            id="${id}-default"
            name="${id}-default"
            value="${value.default}"
            ?readonly=${!this.editable}
          />`;
          break;
        }

        case "boolean": {
          valueType = "boolean";
          defaultValue = html`<input
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
          defaultValue = html`<input
            type="number"
            id="${id}-default"
            name="${id}-default"
            value="${value.default}"
            ?readonly=${!this.editable}
          />`;
          break;
        }

        case "string":
        default: {
          // string
          defaultValue = html`<input
            type="text"
            id="${id}-default"
            name="${id}-default"
            value="${value.default}"
            ?readonly=${!this.editable}
          />`;
          break;
        }
      }

      return html`<details open class=${classMap({ [valueType]: true })}>
        <summary>${value.title ?? id}</summary>
        <div class="schema-item">
          <label for="${id}-id">ID</label>
          <input
            name="${id}-id"
            id="${id}-id"
            type="text"
            pattern="^[0-9a-z\\-]+$"
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

          <label for="${id}-default">Default</label>
          ${defaultValue}

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
    const schema: Schema = structuredClone(this.schema);
    schema.properties = schema.properties || {};

    if (this.#formRef.value) {
      const form = this.#formRef.value;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
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
        const inRequired = form.querySelector(
          `#${id}-required`
        ) as HTMLInputElement | null;

        const oldType = property.type;
        const oldDefault = property.default;

        property.title = inTitle?.value || property.title;
        property.type = inType?.value || property.type;
        property.default =
          inDefault?.type === "checkbox"
            ? inDefault.checked.toString()
            : inDefault?.value ?? property.default;

        // Going from boolean -> anything else with no default means removing
        // the value entirely.
        if (
          oldType === "boolean" &&
          (oldDefault === "false" || oldDefault === "") &&
          property.type !== oldType
        ) {
          property["default"] = "";
        }

        if (inID && inID.value && inID.value !== id) {
          renamedProperties.set(id, inID.value);
        }

        if (inRequired) {
          schema.required = schema.required || [];
          if (inRequired.checked) {
            const required = new Set(schema.required);
            required.add(id);
            schema.required = [...required];
          }
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

    this.schema = schema;
  }

  #createEmptyProperty() {
    const schema: Schema = structuredClone(this.schema);
    schema.properties = schema.properties || {};

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
    if (this.schema.type !== "object") {
      return html`Only object schemas are supported`;
    }

    let properties: HTMLTemplateResult | symbol = nothing;
    if (this.schema.properties) {
      properties = this.#convertPropertiesToForms(
        this.schema.properties,
        this.schema.required || []
      );
    }

    return html`<form ${ref(this.#formRef)}>${properties}</form>
      <div id="controls">
        <button
          id="add-new-item"
          type="button"
          ?disabled=${!this.editable}
          @click=${this.#createEmptyProperty}
        >
          Add a new item
        </button>
      </div>`;
  }
}
