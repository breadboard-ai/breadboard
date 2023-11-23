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

export type InputArgs = {
  schema: Schema;
};

export type InputData = Record<string, unknown>;

export type InputOptios = {
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

/**
 * A simple "Was I supposed to remember something?" flag.
 */
class ShortTermMemory {
  #computeKey(properties: Record<string, Schema>) {
    return Object.values(properties)
      .map((value) => value.title)
      .join("#");
  }
  rememberSaving(properties: Record<string, Schema>) {
    globalThis.sessionStorage.setItem(this.#computeKey(properties), "yes");
  }

  didSave(properties: Record<string, Schema>): boolean {
    return !!globalThis.sessionStorage.getItem(this.#computeKey(properties));
  }
}

const isMultiline = (schema: Schema) => {
  return schema.format == "multiline";
};

const isSelect = (schema: Schema) => {
  return schema.enum && schema.enum.length > 0;
};

const isBoolean = (schema: Schema) => {
  return schema.type == "boolean";
};

export class Input extends HTMLElement {
  args: InputArgs;
  id: string;
  remember: boolean;
  secret: boolean;
  #memory = new ShortTermMemory();

  constructor(
    id: string,
    args: InputArgs,
    { remember = false, secret = false }: InputOptios = {
      remember: false,
      secret: false,
    }
  ) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
        }

        * {
          box-sizing: border-box; 
          font-size: var(--bb-text-medium);
        }

        form {
          display: flex;
          flex-direction: column;
        }

        label {
          font-family: var(--bb-font-family);
          font-size: var(--bb-text-small);
          margin-top: calc(var(--bb-grid-size) * -6);
          padding: 0 0 calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 8);
        }

        #input {
          position: relative;
        }

        input[type=text],
        input[type=password],
        .parsed-value {
          border-radius: calc(var(--grid-size) * 10);
          background: rgb(255, 255, 255);
          height: calc(var(--grid-size) * 12);
          padding: 0 calc(var(--grid-size) * 10) 0 calc(var(--grid-size) * 8);
          width: 100%;
          border: 1px solid rgb(209, 209, 209);
        }

        div#input {
          min-height: calc(var(--grid-size) * 12);
        }

        input[type=text]::placeholder,
        input[type=password]::placeholder {
          font-size: var(--bb-text-medium);
        }

        .parsed-value {
          background: rgb(250, 250, 250);
          color: var(--bb-font-color-faded);
          display: flex;
          align-items: center;
          font-size: var(--bb-text-medium);
        }

        input[type=submit] {
          font-size: 0;
          width: calc(var(--grid-size) * 8);
          height: calc(var(--grid-size) * 8);
          position: absolute;
          right: calc(var(--grid-size) * 2);
          top: calc(var(--grid-size) * 2);
          border-radius: 50%;
          background: #FFF var(--bb-icon-start) center center no-repeat;
          border: none;
        }
        
        textarea {
          width: 100%;
        }

        span {
          flex: 1;
        }

        img {
          max-width: 80%;
          height: 6rem;
        }

        textarea {
          height: 10rem;
        }
      </style>
    `;
    this.args = args;
    this.id = id;
    this.remember = remember;
    this.secret = secret;
  }

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
    return;
  }

  #createBooleanInput(schema: Schema, values: InputData, key: string) {
    const input = document.createElement("input");
    input.name = key;
    input.id = key;
    input.type = "checkbox";
    input.checked = !!values[key] ?? schema.default ?? false;
    return input;
  }

  #createSingleLineInput(schema: Schema, values: InputData, key: string) {
    const input = document.createElement("input");
    input.name = key;
    input.id = key;
    input.type = this.secret ? "password" : "text";
    input.autocomplete = this.secret ? "off" : "on";
    input.placeholder = schema.description || "";
    input.autofocus = true;
    input.value = (values[key] as string) ?? schema.default ?? "";
    return input;
  }

  #createMultiLineInput(schema: Schema, values: InputData, key: string) {
    const span = document.createElement("span");
    const textarea = span.appendChild(document.createElement("textarea"));
    textarea.name = key;
    textarea.id = key;
    textarea.placeholder = schema.description || "";
    textarea.value = (values[key] as string) ?? schema.default ?? "";
    return span;
  }

  #createInput(schema: Schema, values: InputData, key: string) {
    if (isSelect(schema)) {
      const select = document.createElement("select");
      select.name = key;
      schema.enum?.forEach((value) => {
        const option = select.appendChild(document.createElement("option"));
        option.value = value;
        option.textContent = value;
      });
      const defaultIndex = schema.default
        ? schema.enum?.indexOf(schema.default) || -1
        : -1;
      if (defaultIndex >= 0) select.selectedIndex = defaultIndex;
      return select;
    } else if (isBoolean(schema)) {
      return this.#createBooleanInput(schema, values, key);
    } else if (isMultipart(schema)) {
      return createMultipartInput(schema, key);
    } else {
      const isMultiline = schema.format == "multiline";
      const input = isMultiline
        ? this.#createMultiLineInput(schema, values, key)
        : this.#createSingleLineInput(schema, values, key);
      window.setTimeout(() => input.focus(), 100);
      return input;
    }
  }

  async ask() {
    const schema = this.args.schema;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const root = this.shadowRoot!;
    const input = document.createElement("div");
    input.id = "input";
    root.append(input);

    if (!schema || !schema.properties) {
      input.textContent =
        "No input schema detected, unable to provide useful interaction.";

      return {};
    }

    const properties = schema.properties;
    const values = this.#getRememberedValues();
    const form = input.appendChild(document.createElement("form"));
    let insertSubmitButton = true;
    Object.entries(properties).forEach(([key, property], index) => {
      const needsSubmitButton = isMultiline(property) || isMultipart(property);
      if (index > 0 || needsSubmitButton) insertSubmitButton = true;

      const label = form.appendChild(document.createElement("label"));
      label.setAttribute("for", key);
      label.textContent = `${property.title}`;

      const input = this.#createInput(property, values, key);
      form.appendChild(input);
    });

    if (insertSubmitButton) {
      const submit = form.appendChild(document.createElement("input"));
      submit.type = "submit";
      submit.value = "Continue";
    }

    if (this.remember && this.#memory.didSave(properties))
      return Promise.resolve(values);

    return new Promise((resolve) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data: InputData = {};
        await Promise.all(
          Object.entries(properties).map(async ([key, property]) => {
            if (isMultipart(property)) {
              const { html, value } = await getMultipartValue(form, key);
              data[key] = value;
              root.append(`${property.title}: `, ...html);
            } else {
              const input = form[key];
              if (input.value) {
                const parsedValue = parseValue(property.type, input);
                data[key] = parsedValue;
                if (!this.secret) {
                  const label = document.createElement("label");
                  label.textContent = `${property.title}`;
                  const value = document.createElement("div");
                  value.classList.add("parsed-value");
                  value.textContent = `${parsedValue}`;

                  root.appendChild(label);
                  root.appendChild(value);
                }
              }
            }
          })
        );
        this.#rememberValues(data);
        if (this.remember) this.#memory.rememberSaving(properties);
        input.remove();
        resolve(data);
      });
    });
  }
}
