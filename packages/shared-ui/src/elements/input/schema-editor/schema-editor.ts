/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { BehaviorSchema, Schema } from "@google-labs/breadboard";
import {
  css,
  html,
  HTMLTemplateResult,
  LitElement,
  nothing,
  PropertyValueMap,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { guard } from "lit/directives/guard.js";
import { map } from "lit/directives/map.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { createAllowListFromProperty } from "../../../utils/llm-content.js";
import {
  assertIsLLMContent,
  resolveArrayType,
  resolveBehaviorType,
} from "../../../utils/schema.js";

const STORAGE_PREFIX = "bb-schema-editor";

@customElement("bb-schema-editor")
export class SchemaEditor extends LitElement {
  @property({ reflect: false })
  nodeId: string | null = null;

  @property()
  schema: Schema | null = {};

  @property()
  schemaVersion = 0;

  @state()
  expanded = new Map<string, boolean>();

  #formRef: Ref<HTMLFormElement> = createRef();
  #schemaPropertiesOrder: string[] = [];

  static styles = css`
    :host {
      display: block;
    }

    #apply-changes[disabled],
    #create-new-port[disabled] {
      display: none;
    }

    #create-new-port {
      display: flex;
      align-items: center;
      background: none;
      border: none;
      font-size: 0;
      cursor: pointer;
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      color: var(--bb-neutral-900);
      padding: 0;
      opacity: 0.6;
    }

    #create-new-port::before {
      content: "";
      width: 20px;
      height: 20px;
      background: var(--bb-icon-add-circle) center center / 20px 20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #create-new-port:hover,
    #create-new-port:focus {
      opacity: 1;
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

    .schema-item {
      display: grid;
      align-items: center;
      grid-template-columns: 100px auto;
      row-gap: var(--bb-grid-size);
      column-gap: var(--bb-grid-size);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-50);
      border-radius: var(--bb-grid-size-2);
      margin: var(--bb-grid-size-4) 0;
      overflow-x: auto;
    }

    .schema-item:first-of-type {
      margin-top: 0;
    }

    .schema-item label {
      font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      align-self: center;
    }

    .schema-item input[type="checkbox"] {
      justify-self: start;
    }

    .schema-item input,
    .schema-item select {
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-0);
      margin: 0;
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .schema-item select {
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      background: var(--bb-neutral-0) var(--bb-icon-expand) calc(100% - 5px)
        4px / 16px 16px no-repeat;
    }

    .schema-item select[multiple] {
      resize: vertical;
      background: var(--bb-neutral-0);
    }

    .schema-item select option {
      padding: 0;
    }

    .schema-item textarea {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      resize: vertical;
      display: block;
      box-sizing: border-box;
      width: 100%;
      field-sizing: content;
      max-height: 300px;
      min-height: var(--bb-grid-size-5);
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
    }

    #controls {
      display: flex;
    }

    button[disabled] {
      opacity: 0.5;
    }

    .title-and-delete,
    .type-and-required {
      display: flex;
    }

    .title-and-delete input[type="text"],
    .type-and-required select {
      flex: 1;
    }

    .type-and-required input[type="checkbox"] {
      margin: 0 var(--bb-grid-size) 0 var(--bb-grid-size-2);
    }

    .title-and-delete .delete {
      width: 24px;
      height: 24px;
      border: none;
      font-size: 0;
      background: transparent var(--bb-icon-delete) center center / 20px 20px
        no-repeat;
      margin-left: var(--bb-grid-size-2);
    }

    bb-llm-input {
      margin-top: var(--bb-grid-size);
      --bb-border-size: 1px;
    }

    .show-more,
    .show-less {
      grid-column: 1/3;
      border: none;
      background: transparent;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .show-more {
      display: block;
      background: transparent var(--bb-icon-expand) calc(50% - 44px) center /
        20px 20px no-repeat;
    }

    .show-less {
      display: none;
      background: transparent var(--bb-icon-collapse) calc(50% - 44px) center /
        20px 20px no-repeat;
    }

    .expanded .show-more {
      display: none;
    }

    .expanded .show-less {
      display: block;
    }

    .more-info {
      display: none;
      align-items: center;
      grid-template-columns: 100px auto;
      row-gap: var(--bb-grid-size);
      column-gap: var(--bb-grid-size);
      grid-column: 1/3;
    }

    .expanded .more-info {
      display: grid;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    this.expanded.clear();
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ nodeId: string }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("nodeId")) {
      return;
    }
    const expandedData = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-${this.nodeId}-expanded`
    );

    if (!expandedData) {
      return;
    }

    const expanded = JSON.parse(expandedData) as [string, boolean][];
    this.expanded = new Map(expanded);
  }

  get value() {
    return this.schema;
  }

  #toggleExpanded(key: string) {
    if (!this.nodeId) {
      return;
    }

    let val = this.expanded.get(key);
    if (val === undefined) {
      this.expanded.set(key, false);
      val = false;
    }

    this.expanded.set(key, !val);
    globalThis.sessionStorage.setItem(
      `${STORAGE_PREFIX}-${this.nodeId}-expanded`,
      JSON.stringify([...this.expanded.entries()])
    );
    this.requestUpdate();
  }

  #convertPropertiesToForms(
    properties: Record<string, Schema>,
    required: string[]
  ) {
    // The only times these are expected to be unmatched are:
    // 1. We have an entirely new Schema and the current order is unknown.
    // 2. When we traverse the history.
    //
    // In such cases we (re)create the schema property order.
    if (Object.keys(properties).length !== this.#schemaPropertiesOrder.length) {
      this.#schemaPropertiesOrder = Object.keys(properties);
    }

    return html`${map(this.#schemaPropertiesOrder, (id) => {
      const value = properties[id];
      const enumerations = html`<label for="${id}-enum">User choices</label>
        <bb-array-editor
          id="${id}-enum"
          name="${id}-enum"
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
            <select name="${id}-items" id="${id}-items">
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
            <select name="${id}-behavior" id="${id}-behavior">
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
            <select name="${id}-format" id="${id}-format" type="text">
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
      }

      const defaultLabel = html` <label for="${id}-default">Default</label>`;
      let defaultValue: HTMLTemplateResult | symbol = nothing;
      switch (value.type) {
        case "array": {
          let items: Array<string | number | object> | null = null;
          try {
            items = JSON.parse(value.default || "null");
          } catch (err) {
            items = null;
          }

          defaultValue = html`${defaultLabel}<bb-array-editor
              id="${id}-default"
              name="${id}-default"
              .items=${items}
              .type=${resolveArrayType(value)}
              .behavior=${resolveBehaviorType(value.items)}
            ></bb-array-editor>`;
          break;
        }

        case "boolean": {
          defaultValue = html`${defaultLabel}<input
              type="checkbox"
              id="${id}-default"
              name="${id}-default"
              ?checked="${value.default === "true"}"
            />`;
          break;
        }

        case "number": {
          defaultValue = html`${defaultLabel}<input
              type="number"
              id="${id}-default"
              name="${id}-default"
              value="${value.default}"
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
              >
                ${map(value.enum, (option) => {
                  return html`<option ?selected=${option === value.default}>
                    ${option}
                  </option>`;
                })}
              </select>`;
          } else if (value.behavior?.includes("llm-content")) {
            let defaultValueContent: LLMContent | null = null;
            try {
              defaultValueContent = JSON.parse(value.default || "null");
              assertIsLLMContent(defaultValueContent);
            } catch (err) {
              defaultValueContent = null;
            }

            const allow = createAllowListFromProperty(value);
            defaultValue = html`${guard(
              [this.nodeId],
              () =>
                html`${defaultLabel}<bb-llm-input
                    id="${id}-default"
                    name="${id}-default"
                    .clamped=${true}
                    .allow=${allow}
                    .value=${defaultValueContent}
                  ></bb-llm-input>`
            )}`;
          } else {
            defaultValue = html`${defaultLabel}<input
                type="text"
                id="${id}-default"
                name="${id}-default"
                value="${value.default || ""}"
              />`;
          }
          break;
        }
      }

      const examples = html`<label for="${id}-examples">Examples</label>
        <bb-array-editor
          id="${id}-examples"
          name="${id}-examples"
          .items=${value.examples || []}
          .type=${value.type}
        ></bb-array-editor>`;

      return html`<div
        class=${classMap({
          ["schema-item"]: true,
          expanded: this.expanded.get(id) || false,
        })}
      >
        <label for="${id}-title">Title</label>
        <div class="title-and-delete">
          <input
            name="${id}-title"
            id="${id}-title"
            type="text"
            .value="${value.title || ""}"
          />
          <button
            class="delete"
            type="button"
            @click=${() => this.#deleteProperty(id)}
          >
            Delete
          </button>
        </div>

        <label for="${id}-type">Type</label>
        <div class="type-and-required">
          <select name="${id}-type" id="${id}-type" type="text">
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

          <input
            name="${id}-required"
            id="${id}-required"
            type="checkbox"
            ?checked=${required.includes(id)}
          />
          <label for="${id}-required">Required</label>
        </div>

        ${itemType} ${behavior} ${format}
        <button class="show-more" @click=${() => this.#toggleExpanded(id)}>
          Show more
        </button>
        <div class="more-info">
          <label for="${id}-title">ID</label>
          <input
            name="${id}-id"
            id="${id}-id"
            type="text"
            pattern="^[a-z\\-_][a-zA-Z0-9\\-_]*$"
            .value="${id}"
            required="required"
          />
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
          ></textarea>

          <label for="${id}-config">Configured</label>
          <input
            name="${id}-config"
            id="${id}-config"
            type="checkbox"
            ?checked=${value.behavior?.includes("config")}
          />

          <button class="show-less" @click=${() => this.#toggleExpanded(id)}>
            Show less
          </button>
        </div>
      </div>`;
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
        const inConfig = form.querySelector(
          `#${id}-config`
        ) as HTMLInputElement | null;

        const oldType = property.type;
        const oldBehavior = property.behavior;

        property.title = inTitle?.value || property.title;
        property.type = inType?.value || property.type;
        property.description = inDescription?.value || property.description;
        property.examples = JSON.parse(inExamples?.value || "[]") as string[];

        const userChoices = JSON.parse(inEnum?.value || "[]") as string[];

        if (property.type === "string") {
          if (inFormat && inFormat.value !== "none") {
            property.format = inFormat.value;
          }
        }

        if (property.type === "object") {
          if (inBehavior) {
            if (inBehavior.value !== "none") {
              property.behavior = [inBehavior.value as BehaviorSchema];
            } else {
              delete property.behavior;
            }
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
          } else if (typeof inDefault.value === "object") {
            property.default = JSON.stringify(inDefault.value);
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
          delete property.default;
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
          (!property.behavior || !property.behavior.includes("llm-content"))
        ) {
          delete property.format;
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

        if (inConfig) {
          if (inConfig.checked) {
            property.behavior = property.behavior || [];
            if (!property.behavior.includes("config")) {
              property.behavior.push("config");
            }
          } else {
            property.behavior = property.behavior?.filter(
              (item) => item !== "config"
            );
            if (property.behavior && !property.behavior?.length) {
              delete property.behavior;
            }
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

        const expandedState = this.expanded.get(from);
        if (expandedState !== undefined) {
          this.expanded.set(to, expandedState);
          this.expanded.delete(from);
        }

        // Ensure stable property order by updating the property name in the
        // ordered listing.
        this.#schemaPropertiesOrder = this.#schemaPropertiesOrder.map(
          (property) => {
            if (property === from) {
              return to;
            }

            return property;
          }
        );
      }
    }

    if (schema.properties) {
      schema.type = "object";
    }

    this.schema = schema;
    this.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
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

    this.#schemaPropertiesOrder = this.#schemaPropertiesOrder.filter(
      (item) => item !== id
    );

    this.schema = schema;
    this.applyPendingChanges();
  }

  #createNewPort() {
    const schema: Schema = structuredClone(this.schema || {});
    schema.properties =
      typeof schema.properties === "object" ? schema.properties : {};

    const idx = Object.keys(schema.properties).length + 1;
    const key = `property-${idx}`;
    schema.properties = schema.properties || {};
    schema.properties[key] = {
      type: "object",
      behavior: ["llm-content"],
      title: `Property ${idx}`,
    };

    this.#schemaPropertiesOrder.push(key);

    this.schema = schema;
    this.applyPendingChanges();
  }

  render() {
    const properties = this.#convertPropertiesToForms(
      this.schema?.properties || {},
      this.schema?.required || []
    );

    return html` <form
        @submit=${(evt: Event) => {
          evt.preventDefault();
        }}
        @input=${(evt: InputEvent) => {
          evt.stopImmediatePropagation();

          this.applyPendingChanges();
        }}
        ${ref(this.#formRef)}
      >
        ${properties}
      </form>
      <div id="controls">
        <button
          id="create-new-port"
          type="button"
          @click=${this.#createNewPort}
        >
          Add a port
        </button>
      </div>`;
  }
}
