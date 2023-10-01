/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Schema } from "jsonschema";

export interface UI {
  progress(message: string): void;
  output(values: OutputArgs): void;
  input(args: InputArgs): Promise<Record<string, unknown>>;
  error(message: string): void;
  done(): void;
}

export type InputArgs = {
  schema: Schema;
};

export type OutputArgs = Record<string, unknown> & {
  schema: Schema;
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
    console.log("OUTPUT", values);
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
  constructor(args: InputArgs) {
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
    const form = input.appendChild(document.createElement("form"));
    Object.entries(properties).forEach(([key, property]) => {
      const label = form.appendChild(document.createElement("label"));
      label.textContent = `${property.title}: `;
      const input = label.appendChild(document.createElement("input"));
      input.name = key;
      input.placeholder = property.description || "";
      input.autofocus = true;
      form.append("\n");
    });
    return new Promise((resolve) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {};
        Object.entries(properties).forEach(([key, property]) => {
          const input = form[key];
          if (input.value) {
            data[key] = input.value;
            root.append(`${property.title}: ${input.value}\n`);
          }
        });
        input.remove();
        resolve(data);
      });
    });
  }
}
customElements.define("bb-input", Input);

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

  progress(message: string) {
    this.removeProgress();
    this.append(new Progress(message));
  }

  output(values: OutputArgs) {
    this.removeProgress();
    this.append(new Output(values));
  }

  async input(args: InputArgs): Promise<Record<string, unknown>> {
    this.removeProgress();
    const input = new Input(args);
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
