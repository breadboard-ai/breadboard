/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "@google-labs/breadboard";
import {
  isMicrophoneAudio,
  isBoolean,
  isDrawableImage,
  isMultiline,
  isSelect,
  isWebcamImage,
  isLLMContent,
  isLLMContentArray,
} from "../../utils/index.js";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { InputEnterEvent, InputErrorEvent } from "../../events/events.js";
import { WebcamInput } from "./webcam/webcam.js";
import { DrawableInput } from "./drawable/drawable.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { AudioInput } from "./audio/audio.js";
import { LLMContent } from "../../types/types.js";
import { LLMInput } from "./llm-input/llm-input.js";
import {
  createAllowListFromProperty,
  getMinItemsFromProperty,
} from "../../utils/llm-content.js";
import { LLMInputArray } from "../elements.js";

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
  secret = false;

  /**
   * If true and `values` are provided, will automatically dispatch
   * the `InputEvent` (currently used in secrets). Otherwise, will
   * use `values` as initial input data.
   */
  @property()
  autosubmit = false;

  @property({ reflect: false })
  schema: Schema | null = null;

  @property({ reflect: false })
  values: InputData | null = null;

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

    if (!this.schema || !this.schema.properties) {
      console.warn(`Unable to process form: no input Schema detected`);
      return;
    }

    const { properties } = this.schema;
    const form = evt.target;

    if (!properties) {
      return html`Unable to render: no input Schema detected`;
    }

    const data: InputData = {};

    for (const [key, property] of Object.entries(properties)) {
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
        const isAudio = element instanceof AudioInput;
        if (isImage || isAudio) {
          const value = element.value;
          data[key] = value;
        }

        const isLLMContent = element instanceof LLMInput;
        if (isLLMContent) {
          // If there are any uncommitted parts, ask the LLM Input to handle
          // them at this point.
          await element.processAllOpenParts();
          const value = element.value;
          if (
            !element.value ||
            element.value.parts.length === 0 ||
            !element.hasMinItems()
          ) {
            const event = new InputErrorEvent(
              `Minimum number of LLM Content items not found`
            );
            this.dispatchEvent(event);
            return;
          }

          data[key] = value;
        }

        const isLLMContentArray = element instanceof LLMInputArray;
        if (isLLMContentArray) {
          // If there are any uncommitted parts, ask the LLM Input to handle
          // them at this point.
          await element.processAllOpenParts();
          const value = element.values;
          if (!element.values || !element.hasMinItems()) {
            const event = new InputErrorEvent(
              `Minimum number of LLM Content items not found`
            );
            this.dispatchEvent(event);
            return;
          }

          data[key] = value;
        }
      }
    }

    this.dispatchEvent(
      new InputEnterEvent(this.id, data, /* allowSavingIfSecret */ true)
    );
  }

  render() {
    if (!this.schema) {
      return html`Unable to render: no input Schema detected`;
    }

    const { properties } = this.schema;
    if (!properties) {
      return html`Unable to render: no input Schema detected`;
    }

    // Special case for when we have – say – a secret stored. Here we neither
    // render the form, nor the retrieved value, but instead we just dispatch
    // the event with the value in and stop rendering.
    if (this.values && this.autosubmit) {
      this.dispatchEvent(
        new InputEnterEvent(
          this.id,
          this.values,
          /* allowSavingIfSecret */ true
        )
      );
      return;
    }

    try {
      return this.#renderForm(properties, this.values || {});
    } catch (e) {
      const event = new InputErrorEvent(`${e}`);
      this.dispatchEvent(event);
    }
  }

  #renderForm(properties: Record<string, Schema>, values: InputData) {
    return html`<div id="input">
      <form ${ref(this.#formRef)} @submit=${this.#onSubmit}>
        ${Object.entries(properties).map(([key, property]) => {
          const label = html`<label for="${key}"
            >${property.title || key}</label
          >`;
          let input;

          if (isLLMContent(property)) {
            let value: LLMContent | null = null;
            value = values[key] as LLMContent | null;
            if (!value) {
              const unparsedValue =
                property.examples && property.examples.length
                  ? property.examples[0]
                  : property.default;
              value = unparsedValue ? JSON.parse(unparsedValue) : null;
            }

            if (Array.isArray(value)) {
              value = value[0] as LLMContent;
              console.warn(
                "Default value is an array where single value is expected - using first item"
              );
            }

            const allow = createAllowListFromProperty(property);
            const minItems = getMinItemsFromProperty(property);
            input = html`<bb-llm-input
              id="${key}"
              @keydown=${(evt: KeyboardEvent) => {
                if (!(evt.key === "Enter" && evt.metaKey)) {
                  return;
                }

                this.processInput();
              }}
              .description=${property.description}
              .value=${value}
              .allow=${allow}
              .minItems=${minItems}
            ></bb-llm-input>`;
          } else if (isLLMContentArray(property)) {
            let value: LLMContent[] | null = null;
            value = values[key] as LLMContent[] | null;
            if (!value) {
              const unparsedValue = property.default;
              value = unparsedValue
                ? JSON.parse(unparsedValue)
                : [{ parts: [], role: "user" }];
            }

            const allow = createAllowListFromProperty(property);
            const minItems = getMinItemsFromProperty(property);
            input = html`<bb-llm-input-array
              id="${key}"
              @keydown=${(evt: KeyboardEvent) => {
                if (!(evt.key === "Enter" && evt.metaKey)) {
                  return;
                }

                this.processInput();
              }}
              .description=${property.description}
              .values=${value}
              .allow=${allow}
              .minItems=${minItems}
            ></bb-llm-input-array>`;
          } else if (isMicrophoneAudio(property)) {
            input = html`<bb-audio-input id="${key}"></bb-audio-input>`;
          } else if (isWebcamImage(property)) {
            input = html`<bb-webcam-input id="${key}"></bb-webcam-input>`;
          } else if (isDrawableImage(property)) {
            input = html`<bb-drawable-input id="${key}"></bb-drawable-input>`;
          } else if (isSelect(property)) {
            // Select input.
            const options = property.enum || [];
            input = html`<div>
              <select name="${key}" id="${key}">
                ${options.map((option) => {
                  const isSelected = option === property.default;
                  return html`<option ?selected=${isSelected} value=${option}>
                    ${option}
                  </option>`;
                })}
              </select>
              <div></div>
            </div>`;
          } else if (isBoolean(property)) {
            // Checkbox / Boolean input.
            const checked = !!values[key] ?? property.default ?? false;
            input = html`<input
              name="${key}"
              id="${key}"
              type="checkbox"
              ?checked=${checked}
            />`;
          } else {
            // Text inputs: multi line and single line.
            const examples = property.examples?.[0];
            let value =
              (values[key] as string) ?? examples ?? property.default ?? "";
            value =
              typeof value === "string"
                ? value
                : JSON.stringify(value, null, 2);
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
