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

export type LoadArgs = {
  title: string;
  description?: string;
  version?: string;
};

export type StartArgs = {
  boards: {
    title: string;
    url: string;
  }[];
};

class Start extends HTMLElement {
  constructor({ boards }: StartArgs) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
      
        select, button, input {
          font-family: var(--bb-font-family, Fira Code,monospace);
          font-size: var(--bb-font-size, 1rem);
        }
        
        select, button {
          padding: 0.2rem 0.4rem;
        }

        div {
          padding-bottom: 1rem;
        }

        input {
          width: var(--bb-input-width, 80%);
        }

      </style>
      <form>
        <div>
        <label for="sample">Select from one of the sample boards</label>
        <select name="sample" id="sample">
          <option value>- Select -</option>
          ${boards
            .map(({ title, url }) => {
              return `<option value="${url}">${title}</option>`;
            })
            .join("")}
        </select>
        </div>
        <div><label>Or enter your own board URL: 
          <input name="board" id="board">
        </label></div>
        <button type="submit" disabled>Run</button></div>
      </form>
    `;
  }

  disable() {
    const form = this.shadowRoot?.querySelector("form");
    const button = form?.querySelector("button");
    form?.sample.setAttribute("disabled", "");
    form?.board.setAttribute("disabled", "");
    button?.setAttribute("disabled", "");
  }

  enable() {
    const form = this.shadowRoot?.querySelector("form");
    const button = form?.querySelector("button");
    form?.sample.removeAttribute("disabled");
    form?.board.removeAttribute("disabled");
    button?.removeAttribute("disabled");
  }

  async selectBoard() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const root = this.shadowRoot!;
    const form = root.querySelector("form");
    const button = form?.querySelector("button");

    return new Promise((resolve) => {
      form?.sample?.addEventListener("change", () => {
        const sample = form.sample.value;
        form.board.value = sample;
        if (sample) button?.removeAttribute("disabled");
      });
      form?.board?.addEventListener("input", () => {
        const board = form.board.value;
        if (board) button?.removeAttribute("disabled");
      });
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const board = form.board.value;
        resolve(board);
      });
    });
  }
}
customElements.define("bb-start", Start);

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
          color: var(--bb-progress-color, gray);
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

class Load extends HTMLElement {
  constructor({ title, description = "", version = "" }: LoadArgs) {
    super();
    if (version) version = `version: ${version}`;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        h2 {
          font-weight: var(--bb-title-font-weight, normal);
        }
      </style>
      <h2>${title}</h2>
      <p>${description}</p>
      <p>${version}</p>
    `;
  }
}
customElements.define("bb-load", Load);

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
  }

  async start(args: StartArgs) {
    const start = new Start(args);
    this.append(start);
    const board = await start.selectBoard();
    start.disable();
    return board;
  }

  load(info: LoadArgs) {
    this.append(new Load(info));
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
    input.remove();
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
    this.progress("Done. Reload this page to restart.");
  }

  removeProgress() {
    this.querySelector("bb-progress")?.remove();
  }
}
customElements.define("bb-ui", UIController);

export const create = () => new UIController();
