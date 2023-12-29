/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "@google-labs/breadboard";
import {
  createMultipartInput,
  getMultipartValue,
  isMultipart,
} from "./input-multipart.js";
import { ShortTermMemory } from "./utils/short-term-memory.js";
import {
  isBoolean,
  isDrawable,
  isImage,
  isMultiline,
  isSelect,
  isWebcam,
} from "./utils/index.js";
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { InputEnterEvent } from "./events.js";
import { WebcamInput } from "./webcam.js";
import { DrawableInput } from "./drawable.js";
import { InputArgs } from "./types.js";

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
  @property({ reflect: true })
  id = "";

  @state()
  remember = false;

  @state()
  secret = false;

  @state()
  args: InputArgs | null = null;

  @state()
  processedValues: Record<
    string,
    { type: unknown[]; value: unknown[]; title: string }
  > | null = null;

  #memory = new ShortTermMemory();

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      width: 100%;
    }

    * {
      box-sizing: border-box;
      font-size: var(--bb-text-medium);
    }

    form,
    #choice-container {
      display: grid;
      justify-items: start;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      row-gap: calc(var(--bb-grid-size) * 2);
      flex: 1;
      margin: calc(var(--bb-grid-size) * 2) 0;
    }

    #choice-container {
      border-top: 1px solid rgb(244, 244, 244);
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
      font-size: var(--bb-text-medium);
      height: auto;
    }

    input[type="submit"] {
      font-size: 0;
      width: calc(var(--bb-grid-size) * 8);
      height: calc(var(--bb-grid-size) * 8);
      position: absolute;
      right: 0;
      top: calc(var(--bb-grid-size) * 1.5);
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

    if (!this.args || !this.args.schema || !this.args.schema.properties) {
      console.warn(`Unable to process form: no input Schema detected`);
      return;
    }

    const { schema } = this.args;
    const { properties } = schema;
    const form = evt.target;

    if (!properties) {
      return html`Unable to render: no input Schema detected`;
    }

    const data: InputData = {};
    const processedValues: typeof this.processedValues = {};

    for (const [key, property] of Object.entries(properties)) {
      if (isMultipart(property)) {
        const values = await getMultipartValue(form, key);
        data[key] = values.value;
        processedValues[key] = {
          value: values.value,
          type: values.type,
          title: property.title || "Untitled property",
        };
      } else {
        const input = form[key];
        if (input && input.value) {
          const parsedValue = parseValue(property.type, input);
          data[key] = parsedValue;
          processedValues[key] = {
            value: [{ text: parsedValue }],
            type: ["string"],
            title: property.title || "Untitled property",
          };
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
            processedValues[key] = {
              value: [value],
              type: ["image"],
              title: property.title || "Untitled property",
            };
          }
        }
      }
    }

    this.#rememberValues(data);
    if (this.remember) {
      this.#memory.rememberSaving(properties);
    }

    this.processedValues = processedValues;
    this.dispatchEvent(new InputEnterEvent(data));
  }

  render() {
    if (!this.args || !this.args.schema) {
      return html`Unable to render: no input Schema detected`;
    }

    const { schema } = this.args;
    const { properties } = schema;
    const values = this.#getRememberedValues();

    if (!properties) {
      return html`Unable to render: no input Schema detected`;
    }

    if (this.remember && this.#memory.didSave(properties)) {
      this.dispatchEvent(new InputEnterEvent(values));
      return;
    }

    if (this.processedValues) {
      return this.#renderProcessedValues();
    }

    return this.#renderForm(properties, values);
  }

  #renderProcessedValues() {
    if (!this.processedValues) {
      return;
    }

    return html`<div id="choice-container">
      ${Object.entries(this.processedValues).map(
        ([key, { title, type, value }]) => {
          return html`
            <label for="${key}">${title}</label>
            ${value.map((v, index) => {
              switch (type[index]) {
                case "string": {
                  const data = v as {
                    text: string;
                  };
                  return html`<div class="parsed-value">${data.text}</div>`;
                }

                case "image": {
                  const data = v as {
                    inline_data: { mime_type: string; data: string };
                  };

                  const src = `data:${data.inline_data.mime_type};base64,${data.inline_data.data}`;
                  return html`<div class="parsed-value parsed-value-image">
                    <img src="${src}" />
                  </div>`;
                }
              }

              return html`Unknown type`;
            })}
          `;
        }
      )}
    </div>`;
  }

  #renderForm(properties: Record<string, Schema>, values: InputData) {
    return html`<div id="input">
      <form @submit=${this.#onSubmit}>
        ${Object.entries(properties).map(([key, property]) => {
          const label = html`<label for="${key}">${property.title}</label>`;
          let input;
          if (isImage(property)) {
            // Webcam input.
            if (isWebcam(property)) {
              input = html`<bb-webcam-input id="${key}"></bb-webcam-input>`;
            } else if (isDrawable(property)) {
              input = html`<bb-drawable-input id="${key}"></bb-drawable-input>`;
            } else {
              input = html`Image type not supported yet.`;
            }
          } else if (isSelect(property)) {
            // Select input.
            const options = property.enum || [];
            input = html`<select name="${key}" id="${key}">
              ${options.map((option) => {
                const isSelected = option === property.default;
                return html`<option ?selected=${isSelected} value=${option}">${option}</option>`;
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
                  value="${value}"
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
      </form>
    </div>`;
  }
}
