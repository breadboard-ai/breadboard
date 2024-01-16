/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeValue, type Schema } from "@google-labs/breadboard";
import {
  createMultipartInput,
  getMultipartValue,
  isMultipart,
} from "./input-multipart/input-multipart.js";
import { ShortTermMemory } from "../../utils/short-term-memory.js";
import {
  isBoolean,
  isDrawable,
  isMultipartImage,
  isMultiline,
  isSelect,
  isWebcam,
  isMultipartText,
} from "../../utils/index.js";
import { LitElement, html, css, HTMLTemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { InputEnterEvent } from "../../events/events.js";
import { WebcamInput } from "./webcam/webcam.js";
import { DrawableInput } from "./drawable/drawable.js";
import { InputArgs } from "../../types/types.js";

export type InputData = Record<string, unknown>;

export type InputOptions = {
  remember?: boolean;
  secret?: boolean;
};

const parseValue = (type: Schema["type"], input: HTMLInputElement) => {
  if (type === "boolean") return input.checked;

  const value = input.value;
  if (type === "string") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    // TODO: Implement proper validation. Silently failing is not great.
    return value;
  }
};

@customElement("bb-input")
export class Input extends LitElement {
  @property({ reflect: false })
  remember = false;

  @property({ reflect: false })
  secret = false;

  @property({ reflect: false })
  configuration: InputArgs | null = null;

  @property({ reflect: false })
  processedValues: Record<string, NodeValue> | null = null;

  #memory = new ShortTermMemory();

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      width: 100%;
    }

    * {
      box-sizing: border-box;
      font-size: var(--bb-text-nano);
    }

    bb-json-tree {
      width: 100%;
    }

    form,
    #choice-container {
      flex: 1;
    }

    fieldset {
      display: grid;
      justify-items: start;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      row-gap: calc(var(--bb-grid-size) * 2);
      flex: 1;
      margin: calc(var(--bb-grid-size) * 2) 0;
      border: 1px solid rgb(200, 200, 200);
      border-radius: var(--bb-grid-size);
      position: relative;
      padding-bottom: calc(var(--bb-grid-size) * 3);
    }

    legend {
      padding: 0 calc(var(--bb-grid-size) * 2);
    }

    label {
      grid-column: 1/3;
      font-family: var(--bb-font-family);
      font-size: var(--bb-text-small);
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2) 0 0;
    }

    #choice-container label:not(:first-of-type) {
      padding-top: calc(var(--bb-grid-size) * 2);
    }

    label.first-of-type {
      grid-column: 1 / 5;
    }

    #input {
      position: relative;
      flex: 1;
    }

    .multiline {
      grid-column: 1 / 5;
      flex: 1;
      width: 100%;
      overflow: hidden;
      border-radius: calc(var(--bb-grid-size) * 3);
      border: 1px solid rgb(209, 209, 209);
      min-height: calc(var(--bb-grid-size) * 50);
    }

    input[type="text"],
    input[type="password"],
    bb-drawable-input,
    bb-webcam-input,
    textarea,
    .parsed-value {
      grid-column: 1 / 5;
      border-radius: calc(var(--bb-grid-size) * 3);
      background: rgb(255, 255, 255);
      padding: calc(var(--bb-grid-size) * 2);
      width: 100%;
      border: 1px solid rgb(209, 209, 209);
    }

    bb-multipart-input {
      grid-column: 1 / 5;
    }

    textarea {
      resize: none;
      font-size: var(--bb-text-small);
      padding-top: calc(var(--bb-grid-size) * 2);
      padding-bottom: calc(var(--bb-grid-size) * 2);
      line-height: 1.4;
      border: none;
      height: 100%;
    }

    #choice-container img,
    bb-drawable-input,
    bb-webcam-input {
      display: block;
      border-radius: calc(var(--bb-grid-size) * 2);
      border: 1px solid rgb(209, 209, 209);
      padding: 0;
      --bb-box-shadow: none;
    }

    div#input {
      min-height: calc(var(--bb-grid-size) * 12);
    }

    input[type="text"]::placeholder,
    input[type="password"]::placeholder {
      font-size: var(--bb-text-medium);
    }

    #choice-container label {
      grid-column: 1 / 5;
    }

    .parsed-value {
      background: rgb(250, 250, 250);
      color: var(--bb-font-color-faded);
      display: flex;
      align-items: center;
      font-size: var(--bb-text-nano);
      height: auto;
    }

    input[type="submit"] {
      font-size: 0;
      width: calc(var(--bb-grid-size) * 8);
      height: calc(var(--bb-grid-size) * 8);
      position: absolute;
      right: calc(var(--bb-grid-size) * 1.5);
      top: calc(var(--bb-grid-size) * 0.5);
      border-radius: 50%;
      background: var(--bb-icon-start) center center no-repeat;
      border: none;
    }

    input[type="submit"][disabled] {
      opacity: 50%;
    }

    .parsed-value img {
      width: 100%;
      border-radius: calc(var(--bb-grid-size) * 6);
      object-fit: cover;
      aspect-ratio: auto;
    }
  `;

  #getLocalStorageKey() {
    return `bb-remember-${this.id}`;
  }

  #getRememberedValues(): InputData {
    if (!this.remember) return {};
    const key = this.#getLocalStorageKey();
    const data = localStorage.getItem(key);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.warn(`Unable to parse remembered values for ${key}`);
      }
    }
    return {};
  }

  #rememberValues(data: InputData) {
    if (!this.remember) return;
    const key = this.#getLocalStorageKey();
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
  }

  async #onSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement)) {
      console.warn(
        `Unable to process form - event fired from non-form element`
      );
      return;
    }

    if (
      !this.configuration ||
      !this.configuration.schema ||
      !this.configuration.schema.properties
    ) {
      console.warn(`Unable to process form: no input Schema detected`);
      return;
    }

    const { schema } = this.configuration;
    const { properties } = schema;
    const form = evt.target;

    if (!properties) {
      return html`Unable to render: no input Schema detected`;
    }

    const data: InputData = {};

    for (const [key, property] of Object.entries(properties)) {
      if (isMultipart(property)) {
        const values = await getMultipartValue(form, key);
        data[key] = values.value;
      } else {
        const input = form[key];
        if (input && input.value) {
          const parsedValue = parseValue(property.type, input);
          data[key] = parsedValue;
        } else {
          // Custom elements don't look like form elements, so they need to be
          // processed separately.
          const element = form.querySelector(`#${key}`);
          if (!element) {
            console.warn(`Unable to find element for key ${key}`);
            continue;
          }

          const isImage =
            element instanceof WebcamInput || element instanceof DrawableInput;
          if (isImage) {
            const value = element.value;
            data[key] = value;
          }
        }
      }
    }

    this.#rememberValues(data);
    if (this.remember) {
      this.#memory.rememberSaving(properties);
    }

    this.dispatchEvent(new InputEnterEvent(this.id, data));
  }

  render() {
    if (!this.configuration || !this.configuration.schema) {
      return html`Unable to render: no input Schema detected`;
    }

    const { schema } = this.configuration;
    const { properties } = schema;
    const values = this.#getRememberedValues();

    if (!properties) {
      return html`Unable to render: no input Schema detected`;
    }

    // Special case for when we have – say – a secret stored. Here we neither
    // render the form, nor the retrieved value, but instead we just dispatch
    // the event with the value in and stop rendering.
    if (this.remember && this.#memory.didSave(properties)) {
      this.dispatchEvent(new InputEnterEvent(this.id, values));
      return;
    }

    if (this.processedValues) {
      return this.#renderProcessedValues(properties, this.processedValues);
    }

    return this.#renderForm(properties, values);
  }

  #renderProcessedValues(
    properties: Record<string, Schema>,
    processedValues: Record<string, NodeValue>
  ) {
    if (!this.processedValues) {
      return;
    }

    const renderProperty = (
      key: string,
      property: Schema,
      value: unknown
    ): HTMLTemplateResult => {
      // Only recursively render when the items themselves are an array.
      if (Array.isArray(property.items)) {
        const items = property.items as Schema[];
        const values = value as unknown[];
        return html`${items.map((item, idx) =>
          renderProperty(key, item, values[idx])
        )}`;
      }

      if (isMultipartImage(property)) {
        const data = value as {
          inline_data: { mime_type: string; data: string };
        };
        const src = `data:${data.inline_data.mime_type};base64,${data.inline_data.data}`;
        return html`<div class="parsed-value">
          <img src="${src}" />
        </div>`;
      } else if (isMultipartText(property)) {
        return html`<div class="parsed-value">
          ${(value as { text: string }).text}
        </div>`;
      } else if (typeof value === "object") {
        return html`<div class="parsed-value">
          <bb-json-tree .json=${value}></bb-json-tree>
        </div>`;
      } else {
        return html`<div class="parsed-value">${value}</div>`;
      }
    };

    return html`<form id="choice-container">
      <fieldset>
        <legend>${this.id}</legend>
        ${Object.entries(properties).map(([key, property]) => {
          const label = html`<label for="${key}">${property.title}</label>`;
          const value = renderProperty(key, property, processedValues[key]);

          return html`${label}${value}`;
        })}
      </fieldset>
    </form>`;
  }

  #renderForm(properties: Record<string, Schema>, values: InputData) {
    return html`<div id="input">
      <form @submit=${this.#onSubmit}>
        <fieldset>
          <legend>${this.id}</legend>
          ${Object.entries(properties).map(([key, property]) => {
            const label = html`<label for="${key}">${property.title}</label>`;
            let input;
            if (isMultipartImage(property)) {
              // Webcam input.
              if (isWebcam(property)) {
                input = html`<bb-webcam-input id="${key}"></bb-webcam-input>`;
              } else if (isDrawable(property)) {
                input = html`<bb-drawable-input
                  id="${key}"
                ></bb-drawable-input>`;
              } else {
                input = html`Image type not supported yet.`;
              }
            } else if (isSelect(property)) {
              // Select input.
              const options = property.enum || [];
              input = html`<select name="${key}" id="${key}">
                ${options.map((option) => {
                  const isSelected = option === property.default;
                  return html`<option ?selected=${isSelected} value=${option}>
                    ${option}
                  </option>`;
                })}
              </select>`;
            } else if (isBoolean(property)) {
              // Checkbox / Boolean input.
              const checked = !!values[key] ?? property.default ?? false;
              input = html`<input
                name="${key}"
                id="${key}"
                type="checkbox"
                checked="${checked}"
              />`;
            } else if (isMultipart(property)) {
              // Multi-part input.
              const multipart = createMultipartInput(property, key);
              input = html`${multipart}`;
            } else {
              // Text inputs: multi line and single line.
              const value =
                (values[key] as string) ??
                property.examples ??
                property.default ??
                "";
              if (isMultiline(property)) {
                // Multi line input.
                input = html`<div class="multiline">
                  <textarea
                    name="${key}"
                    id="${key}"
                    placeholder="${property.description || ""}"
                    .value=${value}
                  ></textarea>
                </div>`;
              } else {
                // Single line input.
                input = html`<input
                  name="${key}"
                  id="${key}"
                  required="true"
                  type="${this.secret ? "password" : "text"}"
                  autocomplete="${this.secret ? "off" : "on"}"
                  placeholder="${property.description || ""}"
                  autofocus="true"
                  value="${value}"
                />`;
              }
            }

            return html`${label}${input}`;
          })}
          <input type="submit" value="Continue" />
        </fieldset>
      </form>
    </div>`;
  }
}
