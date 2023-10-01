/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "jsonschema";

export interface UI {
  progress(message: string): void;
  output(values: OutputArgs): void;
  input(id: string, args: InputArgs): Promise<Record<string, unknown>>;
  error(message: string): void;
  done(): void;
}

export type InputArgs = {
  schema: Schema;
};

export type InputData = Record<string, string>;

export type InputOptios = {
  remember?: boolean;
  secret?: boolean;
};

export type OutputArgs = Record<string, unknown> & {
  schema: Schema;
};

export type StartArgs = {
  title: string;
  description?: string;
  version?: string;
};

class Progress extends HTMLElement {
  constructor(message: string) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        span {
          color: var(--bb-progress-color, lightgray);
        }
      </style>
      <span>${message}</span>
    `;
  }
}
customElements.define("bb-progress", Progress);

class ErrorMessage extends HTMLElement {
  constructor(message: string) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          color: red;
        }
      </style>
      ${message}
    `;
  }
}
customElements.define("bb-error", ErrorMessage);

class Output extends HTMLElement {
  constructor(values: OutputArgs) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        * {
          white-space: pre-wrap;
        }
      </style>
    `;
    const schema = values.schema;
    if (!schema || !schema.properties) {
      root.append(JSON.stringify(values, null, 2) + "\n");
      return;
    }
    Object.entries(schema.properties).forEach(([key, property]) => {
      const html = document.createElement("span");
      html.innerHTML = `${values[key]}`;
      root.append(`${property.title}: `, html, "\n");
    });
  }
}
customElements.define("bb-output", Output);

class Input extends HTMLElement {
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
        * {
          white-space: pre-wrap;
          font-family: var(--bb-font-family, Fira Code,monospace);
          font-size: var(--bb-font-size, 1rem);
        }
        input {
          width: var(--bb-input-width, 80%);
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
    Object.entries(properties).forEach(([key, property]) => {
      const label = form.appendChild(document.createElement("label"));
      label.textContent = `${property.title}: `;
      const input = label.appendChild(document.createElement("input"));
      input.name = key;
      input.type = this.secret ? "password" : "text";
      input.autocomplete = this.secret ? "off" : "on";
      input.placeholder = property.description || "";
      input.autofocus = true;
      input.value = values[key] ?? "";
      form.append("\n");
      window.setTimeout(() => input.focus(), 1);
    });
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
customElements.define("bb-input", Input);

class Start extends HTMLElement {
  constructor({ title, description = "", version = "" }: StartArgs) {
    super();
    if (version) version = `version: ${version}`;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        h1 {
          font-weight: var(--bb-title-font-weight, normal);
        }
      </style>
      <h1>${title}</h1>
      <p>${description}</p>
      <p>${version}</p>
    `;
  }
}
customElements.define("bb-start", Start);

class UIController extends HTMLElement implements UI {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ::slotted(*) {
          padding-bottom: var(--bb-item-spacing, 0.4rem);
        }
      </style>
      <slot></slot>
    `;
    this.progress("Initializing...");
  }

  start(info: StartArgs) {
    this.append(new Start(info));
  }

  progress(message: string) {
    this.removeProgress();
    this.append(new Progress(message));
  }

  output(values: OutputArgs) {
    this.removeProgress();
    this.append(new Output(values));
  }

  async secret(id: string): Promise<string> {
    const input = new Input(
      id,
      {
        schema: {
          properties: {
            secret: {
              title: id,
              description: `Enter ${id}`,
              type: "string",
            },
          },
        },
      },
      { remember: true, secret: true }
    );
    this.append(input);
    const data = (await input.ask()) as Record<string, string>;
    return data.secret;
  }

  async input(id: string, args: InputArgs): Promise<Record<string, unknown>> {
    this.removeProgress();
    const input = new Input(id, args);
    this.append(input);
    return (await input.ask()) as Record<string, unknown>;
  }

  error(message: string) {
    this.removeProgress();
    this.append(new ErrorMessage(message));
  }

  done() {
    this.removeProgress();
  }

  removeProgress() {
    this.querySelector("bb-progress")?.remove();
  }
}
customElements.define("bb-ui", UIController);
