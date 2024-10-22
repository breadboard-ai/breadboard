/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { customElement, property, state } from "lit/decorators.js";
import { LitElement, css, html, nothing, type PropertyValueMap } from "lit";

import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import PaLMKit from "@google-labs/palm-kit";
import GeminiKit from "@google-labs/gemini-kit";
import AgentKit from "@google-labs/agent-kit";

import { loadKits } from "./utils/kit-loader.js";
import {
  createLoader,
  createRunObserver,
  type BoardServer,
  type GraphProvider,
  type InputValues,
  type InspectableRun,
  type InspectableRunObserver,
  type Kit,
  type Schema,
} from "@google-labs/breadboard";
import {
  run,
  type HarnessRunResult,
  type RunConfig,
} from "@google-labs/breadboard/harness";
import type { InputResolveRequest } from "@google-labs/breadboard/remote";
import { until } from "lit/directives/until.js";
import { isBoolean, isMultiline, isSelect } from "./utils/input.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";

import { getDataStore, getRunStore } from "@breadboard-ai/data-store";

type inputCallback = (data: Record<string, unknown>) => void;

enum STATUS {
  RUNNING,
  STOPPED,
  LOADING,
}

@customElement("bb-api-explorer")
export class ApiExplorer extends LitElement {
  @property()
  url: string | null = null;

  @property()
  run: string | null = null;

  @state()
  runs: InspectableRun[] | null = null;

  @state()
  status = STATUS.STOPPED;

  @state()
  dataStore = getDataStore();

  @state()
  runStore = getRunStore();

  #kits: Kit[] = [];
  #runObserver: InspectableRunObserver = createRunObserver({
    dataStore: this.dataStore,
    runStore: this.runStore,
  });
  #handlers: Map<string, inputCallback[]> = new Map();
  #providers: BoardServer[] = [];
  #kitLoad = loadKits([
    TemplateKit,
    Core,
    PaLMKit,
    GeminiKit,
    NodeNurseryWeb,
    JSONKit,
    AgentKit,
  ]);

  #loader = createLoader(this.#providers);
  #load: Promise<{
    title: string | undefined;
    description: string | undefined;
  }> | null = null;
  #contentRef: Ref<HTMLDivElement> = createRef();
  #outputs = new Map<string, InputValues>();
  #secrets: Record<string, string> = {};

  static override styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      color: var(--bb-neutral-0);
    }

    main {
      display: grid;
      grid-template-rows: 52px auto;
      height: 100%;
      width: 100%;
      overflow: auto;
    }

    header {
      background: var(--bb-neutral-900);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
    }

    header h1 {
      margin: 0;
      padding-bottom: var(--bb-grid-size-3);
      font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
        var(--bb-font-family);
      display: flex;
      align-items: center;
    }

    section {
      position: relative;
      overflow: auto;
      width: 100%;
      scrollbar-gutter: stable;
    }

    #content {
      max-width: 800px;
      margin: 0 auto;
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-12)
        var(--bb-grid-size-4);
    }

    #content table {
      width: 100%;
      margin-top: var(--bb-grid-size-6);
    }

    #content thead td {
      font-weight: bold;
    }

    #content td {
      vertical-align: middle;
    }

    #content td.parameter {
      width: 10%;
    }

    #content td.value {
      width: 65%;
    }

    #content td.description {
      width: 20%;
    }

    #content td.type {
      width: 5%;
    }

    #content textarea,
    #content input[type="text"],
    #content input[type="password"],
    #content select {
      background: var(--bb-neutral-800);
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      white-space: pre-line;
      resize: none;
      padding: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-600);
      border-radius: var(--bb-grid-size-2);
      width: 100%;
      outline: none;
      max-height: 200px;
      white-space: pre-line;
      scrollbar-width: none;
      margin-top: 6px;
    }

    #content textarea,
    #content input[type="text"] {
      field-sizing: content;
    }

    #content input[type="submit"] {
      background: var(--bb-neutral-900);
      border: none;
      border-radius: var(--bb-grid-size-10);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-3);
      font: normal var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
    }

    #content img {
      border-radius: var(--bb-grid-size-3);
      width: 100%;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();

    const currentUrl = new URL(window.location.href);
    const newPathname = currentUrl.pathname.replace(/\.api$/, ".json");
    currentUrl.pathname = newPathname;
    this.url = currentUrl.href;
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ url: string }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("url")) {
      return;
    }

    if (!this.url) {
      return;
    }

    this.#load = this.#kitLoad.then(async (kits) => {
      this.#kits = kits;
      if (!this.url) {
        return { title: "Error", description: "No URL" };
      }

      try {
        const response = await fetch(this.url);
        await response.json();
      } catch (err) {
        return { title: "Error", description: "Unable to load file" };
      }

      const board = await this.#getBoardInfo(this.url);
      this.#runBoard(this.url);

      return board;
    });
  }

  #restored = false;
  async restoreProvidersAndSettingsIfNeeded() {
    if (this.#restored) {
      return;
    }

    this.#restored = true;
    const jobs = this.#providers.map((provider) => provider.restore());
    await Promise.all(jobs);
  }

  async #getBoardInfo(url: string) {
    const loader = createLoader([]);
    const base = new URL(window.location.href);
    const graph = await loader.load(url, { base });
    if (!graph) {
      // TODO: Better error handling, maybe a toast?
      throw new Error(`Unable to load graph: ${url}`);
    }
    const runner = graph;
    const { title, description } = runner;

    if (title) {
      window.document.title = title;
    }

    return { title, description };
  }

  async #runBoard(url: string | null) {
    if (!url) {
      return;
    }

    await this.restoreProvidersAndSettingsIfNeeded();

    const config: RunConfig = {
      url,
      kits: this.#kits,
      diagnostics: true,
      loader: this.#loader,
      store: this.dataStore,
      interactiveSecrets: true,
      inputs: {
        model: "gemini-1.5-flash-latest",
      },
    };

    this.status = STATUS.RUNNING;
    this.#outputs.clear();
    for await (const result of run(config)) {
      await this.#runObserver?.observe(result);
      this.requestUpdate();

      const answer = await this.#handleStateChange(result);

      if (answer) {
        await result.reply({ inputs: answer } as InputResolveRequest);
      }
    }
    this.status = STATUS.STOPPED;
  }

  async #registerInputHandler(id: string): Promise<InputValues> {
    const handlers = this.#handlers.get(id);
    if (!handlers) {
      return Promise.reject(`Unable to set up handler for input ${id}`);
    }

    return new Promise((resolve) => {
      handlers.push((data: Record<string, unknown>) => {
        resolve(data as InputValues);
      });
    });
  }

  async #registerSecretsHandler(keys: string[]): Promise<InputValues> {
    const values = await Promise.all(
      keys.map((key) => {
        if (this.#secrets && this.#secrets[key]) {
          return Promise.resolve([key, this.#secrets[key]]);
        }

        return new Promise<[string, unknown]>((resolve) => {
          const callback = ({ secret }: Record<string, unknown>) => {
            this.#secrets = this.#secrets || {};
            this.#secrets[key] = secret as string;

            resolve([key, secret]);
          };
          this.#handlers.set(key, [callback]);
        });
      })
    );

    return Object.fromEntries(values) as InputValues;
  }

  async #handleStateChange(
    result: HarnessRunResult
  ): Promise<void | InputValues> {
    this.requestUpdate();

    const { data, type } = result;
    switch (type) {
      case "nodestart": {
        if (!this.#handlers.has(data.node.id)) {
          this.#handlers.set(data.node.id, []);
        }
        return;
      }

      case "nodeend": {
        this.#handlers.delete(data.node.id);
        return;
      }

      case "input": {
        return this.#registerInputHandler(data.node.id);
      }

      case "secret": {
        return this.#registerSecretsHandler(data.keys);
      }
    }
  }

  #createInput(properties: Record<string, Schema>) {
    return html`${Object.entries(properties).map(([key, property]) => {
      let input;
      if (isSelect(property)) {
        // Select input.
        const options = property.enum || [];
        input = html` <select name="${key}" id="${key}">
          ${options.map((option) => {
            const isSelected = option === property.default;
            return html`<option ?selected=${isSelected} value=${option}>
              ${option}
            </option>`;
          })}
        </select>`;
      } else if (isBoolean(property)) {
        // Checkbox / Boolean input.
        const checked = property.default ?? false;
        input = html`<input
          name="${key}"
          id="${key}"
          type="checkbox"
          ?checked=${checked}
        />`;
      } else {
        // Text inputs: multi line and single line.
        const examples = property.examples?.[0];
        let value = examples ?? property.default ?? "";
        value =
          typeof value === "string" ? value : JSON.stringify(value, null, 2);
        if (isMultiline(property)) {
          // Multi line input.
          input = html`
            <textarea
              name="${key}"
              id="${key}"
              placeholder="${property.description || ""}"
              .value=${value}
            ></textarea>
          `;
        } else {
          // Single line input.
          input = html`<input
            name="${key}"
            id="${key}"
            required="true"
            type="${property.type === "secret" ? "password" : "text"}"
            autocomplete="${property.type === "secret" ? "off" : "on"}"
            placeholder="${property.description || ""}"
            autofocus="true"
            value="${value}"
          />`;
        }
      }

      return html`<tr>
        <td>${key ?? "(no id)"}</td>
        <td>
          ${input}<input
            name="${key}-data-type"
            type="hidden"
            .value=${property.type || "string"}
          />
        </td>
        <td>${property.description ?? "(no description)"}</td>
        <td>${property.type}</td>
      </tr>`;
    })}`;
  }

  override render() {
    if (!this.url) {
      return html`Unable to load - is this board URL correct?`;
    }

    if (!this.#load) {
      return nothing;
    }

    const handleForm = (evt: SubmitEvent) => {
      evt.preventDefault();

      if (!(evt.target instanceof HTMLFormElement)) {
        return;
      }

      const formData = new FormData(evt.target);
      const handlerId = formData.get("id") as string;
      if (!handlerId) {
        console.warn("Form received with no ID");
        return;
      }

      let data: Record<string, unknown> = {};
      if (formData.has("initial-input")) {
        const initialInputValue = formData.get("initial-input-value") as string;
        data = {
          text: {
            role: "user",
            parts: [
              {
                text: initialInputValue,
              },
            ],
          },
        };
      } else if (formData.has("secret")) {
        const secret = formData.get("secret");
        data = { secret };
      } else {
        formData.forEach((value, key) => {
          if (key.endsWith("-data-type")) {
            return;
          }

          const typeInfo = formData.get(`${key}-data-type`);
          if (typeInfo && typeInfo === "object" && typeof value === "string") {
            try {
              value = JSON.parse(value);
            } catch (err) {
              console.warn(err);
              return;
            }
          }

          data[key] = value;
        });
      }

      const handlers = this.#handlers.get(handlerId) || [];
      if (handlers.length === 0) {
        console.warn(
          `Received event for input(id="${handlerId}") but no handlers were found`
        );
      }

      for (const handler of handlers) {
        handler.call(null, data);
      }
    };

    const loadData = this.#load.then(async ({ title, description }) => {
      if (title === "Error") {
        return html`${description}`;
      }

      const currentRun = (await this.#runObserver.runs())[0];
      const events = currentRun?.events || [];
      const eventPosition = events.length - 1;
      const topEvent = events[eventPosition];

      let content;
      if (topEvent?.type === "secret") {
        content = html` <form @submit=${handleForm}>
          <input type="hidden" name="id" .value=${topEvent.keys.join(",")} />
          <table>
            <thead>
              <tr>
                <td class="parameter">Parameter</td>
                <td class="value">Value</td>
                <td class="description">Description</td>
                <td class="type">Type</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="parameter">${topEvent.keys.join(", ")}</td>
                <td class="value">
                  <input
                    type="password"
                    name="secret"
                    autocomplete="off"
                    placeholder=${topEvent.keys.join(", ")}
                  />
                </td>
                <td class="description">(no description)</td>
                <td class="type">string</td>
              </tr>
            </tbody>
          </table>
          <input type="submit" />
        </form>`;
      }

      if (topEvent?.type === "node" && !topEvent.hidden) {
        const nodeType = topEvent.node.descriptor.type;
        if (nodeType === "input") {
          const configuration = topEvent.inputs;
          const schema = configuration.schema as Schema;
          if (schema) {
            const properties = schema.properties as Record<string, Schema>;
            content = html`<form @submit=${handleForm}>
              <input
                type="hidden"
                name="id"
                .value=${topEvent.node.descriptor.id}
              />
              <table>
                <thead>
                  <tr>
                    <td class="parameter">Parameter</td>
                    <td class="value">Value</td>
                    <td class="description">Description</td>
                    <td class="type">Type</td>
                  </tr>
                </thead>
                <tbody>
                  ${this.#createInput(properties)}
                </tbody>
              </table>
              <input type="submit" />
            </form>`;
          } else {
            content = html`No schema`;
          }
        } else {
          content = html`Error: unexpected node`;
        }
      }

      if (topEvent?.type === "error") {
        content = html`Error: ${JSON.stringify(topEvent.error, null, 2)}`;
      }

      return html` <main>
        <header>
          <h1 id="board-title">${title || "Untitled board"} - API Explorer</h1>
        </header>
        <section>
          <div id="content" ${ref(this.#contentRef)}>${content}</div>
        </section>
      </main>`;
    });

    return html`${until(loadData)}`;
  }
}
