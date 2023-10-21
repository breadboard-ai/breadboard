/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "jsonschema";

export type InputArgs = {
  schema: Schema;
};

export type InputData = Record<string, string>;

export type InputOptios = {
  remember?: boolean;
  secret?: boolean;
};

export class Input extends HTMLElement {
  args: InputArgs;
  id: string;
  remember: boolean;
  secret: boolean;

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
          display: block;
        }
        label {
          display: flex;
        }

        * {
          white-space: pre-wrap;
          font-family: var(--bb-font-family, Fira Code,monospace);
          font-size: var(--bb-font-size, 1rem);
        }
        input[type=text], textarea {
          width: var(--bb-input-width, 80%);
        }

        span {
          flex: 1;
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

  #createSingleLineInput(values: InputData, key: string, description?: string) {
    const input = document.createElement("input");
    input.name = key;
    input.type = this.secret ? "password" : "text";
    input.autocomplete = this.secret ? "off" : "on";
    input.placeholder = description || "";
    input.autofocus = true;
    input.value = values[key] ?? "";
    return input;
  }

  #createMultiLineInput(values: InputData, key: string, description?: string) {
    const span = document.createElement("span");
    const textarea = span.appendChild(document.createElement("textarea"));
    textarea.name = key;
    textarea.placeholder = description || "";
    textarea.value = values[key] ?? "";
    return span;
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
    let insertSubmitButton = false;
    Object.entries(properties).forEach(([key, property], index) => {
      const isMultiline = property.format == "multiline";
      if (index > 0 || isMultiline) insertSubmitButton = true;

      const label = form.appendChild(document.createElement("label"));
      label.textContent = `${property.title}: `;
      const input = isMultiline
        ? this.#createMultiLineInput(values, key, property.description)
        : this.#createSingleLineInput(values, key, property.description);
      label.appendChild(input);
      form.append("\n");
      window.setTimeout(() => input.focus(), 1);
    });
    if (insertSubmitButton) {
      const submit = form.appendChild(document.createElement("input"));
      submit.type = "submit";
      submit.value = "Continue";
    }
    return new Promise((resolve) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data: InputData = {};
        Object.entries(properties).forEach(([key, property]) => {
          const input = form[key];
          if (input.value) {
            data[key] = input.value;
            if (!this.secret)
              root.append(`${property.title}: ${input.value}\n`);
          }
        });
        this.#rememberValues(data);
        input.remove();
        resolve(data);
      });
    });
  }
}
