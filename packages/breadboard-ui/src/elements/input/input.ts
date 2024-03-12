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
} from "../../utils/index.js";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { InputEnterEvent, InputErrorEvent } from "../../events/events.js";
import { WebcamInput } from "./webcam/webcam.js";
import { DrawableInput } from "./drawable/drawable.js";
import { InputArgs } from "../../types/types.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

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
  #formRef: Ref<HTMLFormElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      font-family: var(--bb-font-family);
      font-size: var(--bb-text-medium);
    }

    label {
      font-size: var(--bb-text-small);
      margin: calc(var(--bb-grid-size) * 2) 0 var(--bb-grid-size) 0;
      display: block;
    }

    #input {
      position: relative;
    }

    .multiline {
      display: flex;
      overflow: hidden;
      border-radius: var(--bb-grid-size);
      border: 1px solid rgb(209, 209, 209);
      min-height: calc(var(--bb-grid-size) * 50);
    }

    input[type="text"],
    input[type="password"],
    bb-drawable-input,
    bb-webcam-input,
    textarea,
    .parsed-value {
      border-radius: var(--bb-grid-size);
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      width: 100%;
      border: 1px solid rgb(209, 209, 209);
      font-size: var(--bb-text-medium);
    }

    textarea {
      resize: none;
      font-size: var(--bb-text-small);
      padding-top: calc(var(--bb-grid-size) * 2);
      padding-bottom: calc(var(--bb-grid-size) * 2);
      line-height: 1.4;
      border: none;
      flex: 1 0 auto;
    }

    #choice-container img,
    bb-drawable-input,
    bb-webcam-input {
      display: block;
      border-radius: var(--bb-grid-size);
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

    input[type="submit"] {
      background: var(--bb-continue-color);
      background-image: var(--bb-icon-resume-blue);
      background-size: 16px 16px;
      background-position: 8px 4px;
      background-repeat: no-repeat;
      color: #246db5;
      border-radius: 20px;
      border: none;
      height: 24px;
      padding: 0 16px 0 28px;
      margin: calc(var(--bb-grid-size) * 2) 0 var(--bb-grid-size) 0;
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

  async processInput() {
    if (!this.#formRef.value) {
      return;
    }

    if (this.#formRef.value.reportValidity()) {
      this.#formRef.value.dispatchEvent(new SubmitEvent("submit"));
    }
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
          try {
            const parsedValue = parseValue(property.type, input);
            data[key] = parsedValue;
          } catch (e) {
            const event = new InputErrorEvent(`${e}`);
            this.dispatchEvent(event);
          }
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

    try {
      return this.#renderForm(properties, values);
    } catch (e) {
      const event = new InputErrorEvent(`${e}`);
      this.dispatchEvent(event);
    }
  }

  #renderForm(properties: Record<string, Schema>, values: InputData) {
    return html`<div id="input">
      <form ${ref(this.#formRef)} @submit=${this.#onSubmit}>
        ${Object.entries(properties).map(([key, property]) => {
          const label = html`<label for="${key}">${property.title}</label>`;
          let input;
          if (isMultipartImage(property)) {
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
              ?checked=${checked}
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
      </form>
    </div>`;
  }
}
