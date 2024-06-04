/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { customElement, property, state } from "lit/decorators.js";
import {
  LitElement,
  css,
  html,
  nothing,
  type HTMLTemplateResult,
  type PropertyValueMap,
} from "lit";

import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import PaLMKit from "@google-labs/palm-kit";
import GeminiKit from "@google-labs/gemini-kit";
import AgentKit from "@google-labs/agent-kit";

import { loadKits } from "./utils/kit-loader.js";
import {
  BoardRunner,
  createLoader,
  createRunObserver,
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
import { map } from "lit/directives/map.js";
import type { LLMContent, LLMPart } from "./types.js";
import { isInlineData, isStoredData, isText } from "./utils/output.js";
import { cache } from "lit/directives/cache.js";
import { markdown } from "./directives/markdown.js";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";

import "./elements/nav.js";
import { messages } from "./utils/messages.js";

type inputCallback = (data: Record<string, unknown>) => void;

enum STATUS {
  RUNNING,
  STOPPED,
}

const SPLIT_TEXT_LINE_COUNT = 4;
const formatter = new Intl.NumberFormat();

@customElement("bb-app")
export class App extends LitElement {
  @property()
  url: string | null = null;

  @property()
  run: string | null = null;

  @state()
  runs: InspectableRun[] | null = null;

  @state()
  status = STATUS.STOPPED;

  @state()
  showNav = false;

  #kits: Kit[] = [];
  #runObserver: InspectableRunObserver = createRunObserver();
  #handlers: Map<string, inputCallback[]> = new Map();
  #providers: GraphProvider[] = [];
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
  #partDataURLs = new Map<number, string>();
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
      grid-template-rows: 100px auto;
      height: 100%;
      width: 100%;
      overflow: auto;
    }

    header {
      background: var(--bb-neutral-900);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
      height: 100px;
    }

    header h1 {
      margin: 0;
      padding-bottom: var(--bb-grid-size-3);
      font: 400 var(--bb-title-large) / var(--bb-title-line-height-large)
        var(--bb-font-family);
      display: flex;
      align-items: center;
    }

    header form {
      position: relative;
      max-width: 768px;
      margin: 0 auto;
    }

    header input[type="text"] {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-12)
        var(--bb-grid-size-2) var(--bb-grid-size-6);
      border: none;
      border-radius: 200px;
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      width: 100%;
      background: var(--bb-neutral-700);
      color: var(--bb-neutral-0);
    }

    header input[type="text"]::placeholder {
      color: var(--bb-neutral-400);
    }

    header input[type="submit"] {
      width: 20px;
      height: 20px;
      position: absolute;
      top: var(--bb-grid-size-2);
      right: var(--bb-grid-size-4);
      border: none;
      font-size: 0;

      background: var(--bb-icon-search-inverted) center center / 20px 20px
        no-repeat;
    }

    #show-nav {
      width: 20px;
      height: 20px;
      border: none;
      font-size: 0;
      background: transparent var(--bb-icon-menu) center center / 20px 20px
        no-repeat;
      margin-right: var(--bb-grid-size-2);
      cursor: pointer;
    }

    section {
      position: relative;
      overflow: auto;
      width: 100%;
      scrollbar-gutter: stable;
    }

    #progress {
      height: calc(
        var(--bb-grid-size-5) + var(--bb-grid-size-4) + var(--bb-grid-size-9)
      );
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      max-width: 768px;
      margin: 0 auto;
      padding-left: var(--bb-grid-size-10);
      background: var(--bb-neutral-700);
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      mask: linear-gradient(#ff00ff 90%, rgba(0, 0, 0, 0));
    }

    #progress.start {
      background: var(--bb-icon-smart-toy-inverted) var(--bb-grid-size-4) 50% /
        20px 20px no-repeat;
    }

    #progress.active {
      background: url(/images/progress.svg) var(--bb-grid-size-4) 50% / 20px
        20px no-repeat;
    }

    #content {
      max-width: 800px;
      margin: 0 auto;
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      padding: 0 var(--bb-grid-size-4) var(--bb-grid-size-12)
        var(--bb-grid-size-4);
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
      margin: 0 0 var(--bb-grid-size-2) 0;
      padding: var(--bb-grid-size-3);
      border: 1px solid var(--bb-neutral-600);
      border-radius: var(--bb-grid-size-2);
      width: 100%;
      outline: none;
      max-height: 200px;
      white-space: pre-line;
      scrollbar-width: none;
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

    #content audio {
      width: 100%;
      display: block;
      min-height: 54px;
    }

    #content .text p:first-of-type {
      margin-top: 0;
    }

    #content .text .post {
      display: none;
    }

    #content .text .post.visible {
      display: block;
      animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    #content .text .read-more-less {
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      padding: 0 var(--bb-grid-size-6);
      cursor: pointer;
      color: var(--bb-neutral-0);
      border: none;
      height: 20px;
      background: var(--bb-icon-expand-inverted) 0 0 / 20px 20px no-repeat;
    }

    #content .text .read-more-less.visible {
      background: var(--bb-icon-collapse-inverted) 0 0 / 20px 20px no-repeat;
    }

    #content .entry {
      opacity: 0;
      animation: fadeIn 1.3s cubic-bezier(0, 0, 0.3, 1) 0.4s forwards;
      display: grid;
      grid-template-columns: 1fr;
      column-gap: var(--bb-grid-size-6);
      row-gap: var(--bb-grid-size-2);
      padding-bottom: var(--bb-grid-size-10);
    }

    #content .entry .rest > * {
      margin-bottom: var(--bb-grid-size-4);
    }

    #status-update {
      margin-left: var(--bb-grid-size-2);
      color: var(--bb-neutral-400);
    }

    @media (min-width: 600px) {
      #content .entry {
        grid-template-columns: 1fr 1fr;
        row-gap: var(--bb-grid-size-9);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  constructor() {
    super();

    this.#restoreSecrets();
  }

  #saveSecrets() {
    if (!this.#secrets) {
      return;
    }

    globalThis.localStorage.setItem(
      "secrets",
      JSON.stringify(this.#secrets, null, 2)
    );
  }

  #restoreSecrets() {
    const secrets = globalThis.localStorage.getItem("secrets");
    if (!secrets) {
      return;
    }

    try {
      this.#secrets = JSON.parse(secrets);
    } catch (err) {
      console.warn(err);
      globalThis.localStorage.delete("secrets");
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();

    const currentUrl = new URL(window.location.href);
    const boardFromUrl = currentUrl.searchParams.get("board");
    if (!boardFromUrl || !boardFromUrl.startsWith("@")) {
      return;
    }

    this.url = boardFromUrl;
  }

  protected override willUpdate(
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

    this.url = `https://breadboard.live/boards/${this.url}`;

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
    const runner = await BoardRunner.fromGraphDescriptor(graph);
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
      interactiveSecrets: true,
      inputs: {
        model: "gemini-1.5-flash-latest",
      },
    };

    this.status = STATUS.RUNNING;
    this.#outputs.clear();
    for await (const result of run(config)) {
      this.runs = this.#runObserver?.observe(result);
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

            this.#saveSecrets();
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
      const label = html`<label for="${key}">${property.title || key}</label>`;
      let input;
      if (isSelect(property)) {
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
        </div>`;
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
            type="${property.type === "secret" ? "password" : "text"}"
            autocomplete="${property.type === "secret" ? "off" : "on"}"
            placeholder="${property.description || ""}"
            autofocus="true"
            value="${value}"
          />`;
        }
      }

      return html`${label} ${input}
        <input
          name="${key}-data-type"
          type="hidden"
          .value=${property.type || "string"}
        />`;
    })}`;
  }

  #handleOutput(inputs: InputValues, id: string) {
    return html`<div class="entry">
      ${map(Object.values(inputs), (value) => {
        if (Array.isArray(value)) {
          value = value[0];
        }

        if (typeof value === "object" && value !== null && "parts" in value) {
          const llmValue = value as LLMContent;

          if (llmValue.parts.length === 0) {
            return html`No data in response`;
          }

          const [first, ...rest] = llmValue.parts;
          const partToTemplate = (part: LLMPart | undefined, idx: number) => {
            if (!part) {
              return nothing;
            }

            if (isText(part)) {
              const lines = part.text.split("\n");
              if (lines.length < SPLIT_TEXT_LINE_COUNT) {
                return html`<div class="text">
                  ${markdown(lines.join("\n"))}
                </div>`;
              } else {
                const pre = lines.slice(0, SPLIT_TEXT_LINE_COUNT);
                const post = lines.slice(SPLIT_TEXT_LINE_COUNT);
                return html`<div class="text">
                  <div class="pre">${markdown(pre.join("\n"))}</div>
                  ${post.length > 0
                    ? html`<button
                        class="read-more-less"
                        @click=${(evt: Event) => {
                          if (!this.#contentRef.value) {
                            return;
                          }

                          const post =
                            this.#contentRef.value.querySelector<HTMLElement>(
                              `[data-id="${id}"]`
                            );
                          if (!post) {
                            return;
                          }

                          post.classList.toggle("visible");

                          if (!(evt.target instanceof HTMLButtonElement)) {
                            return;
                          }

                          evt.target.classList.toggle(
                            "visible",
                            post.classList.contains("visible")
                          );
                          evt.target.textContent =
                            evt.target.classList.contains("visible")
                              ? "Read less"
                              : "Read more";
                        }}
                      >
                        Read more
                      </button>`
                    : nothing}
                  <div class="post" data-id=${id}>
                    ${markdown(post.join("\n"))}
                  </div>
                </div>`;
              }
            } else if (isInlineData(part)) {
              const key = idx;
              let partDataURL: Promise<string> = Promise.resolve("No source");
              if (this.#partDataURLs.has(key)) {
                partDataURL = Promise.resolve(this.#partDataURLs.get(key)!);
              } else if (
                part.inlineData.data !== "" &&
                !part.inlineData.mimeType.startsWith("text")
              ) {
                const dataURL = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                partDataURL = fetch(dataURL)
                  .then((response) => response.blob())
                  .then((data) => {
                    const url = URL.createObjectURL(data);
                    this.#partDataURLs.set(key, url);
                    return url;
                  });
              }

              const tmpl = partDataURL.then((url: string) => {
                if (part.inlineData.mimeType.startsWith("image")) {
                  return cache(html`<img src="${url}" alt="LLM Image" />`);
                }
                if (part.inlineData.mimeType.startsWith("audio")) {
                  return cache(html`<audio src="${url}" controls />`);
                }
                if (part.inlineData.mimeType.startsWith("video")) {
                  return cache(html`<video src="${url}" controls />`);
                }
                if (part.inlineData.mimeType.startsWith("text")) {
                  return cache(
                    // prettier-ignore
                    html`<div class="plain-text">${atob(part.inlineData.data)}</div>`
                  );
                }
              });

              return html`${until(tmpl)}`;
            } else if (isStoredData(part)) {
              if (part.storedData.mimeType.startsWith("image")) {
                return html`<img src=${part.storedData.handle} />`;
              } else if (part.storedData.mimeType.startsWith("audio")) {
                return html`<audio
                  controls
                  src=${part.storedData.handle}
                ></audio>`;
              } else {
                return html`Stored data of unknown type.`;
              }
            }

            return html`Unknown part`;
          };

          return html` <div class="first">${partToTemplate(first, 0)}</div>
            <div class="rest">${map(rest, partToTemplate)}</div>`;
        }
      })}
    </div>`;
  }

  #raceMessage() {
    return new Promise((resolve) => {
      const message = Math.floor(Math.random() * messages.length);
      setTimeout(
        () =>
          resolve(html`<span id="status-update">[${messages[message]}]</span>`),
        1000
      );
    });
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

    let initialInputPlaceholder = "";
    const loadData = this.#load.then(({ title, description }) => {
      if (title === "Error") {
        return html`${description}`;
      }

      const currentRun = this.#runObserver.runs()[0];
      const events = currentRun?.events || [];
      const eventPosition = events.length - 1;
      const topEvent = events[eventPosition];

      const initialInputEnabled =
        topEvent?.type === "node" &&
        topEvent.node.descriptor.id === "input" &&
        topEvent.node.descriptor.type === "input";

      const isAtStart = eventPosition === 0;
      const currentNodeDescription =
        topEvent?.type === "node" &&
        topEvent.node.description() !== topEvent.node.title()
          ? topEvent.node.description()
          : html`Working... ${until(this.#raceMessage())}`;

      const progressMessage = isAtStart
        ? description
        : this.status === STATUS.RUNNING
          ? currentNodeDescription
          : null;

      let initialInputValue = "";
      if (initialInputEnabled) {
        const configuration = topEvent.node.configuration();
        const schema = configuration.schema as Schema;
        const properties = schema.properties || {};
        const propertyNames = Object.keys(properties);
        if (propertyNames.length) {
          const [firstPropertyName] = propertyNames;
          if (firstPropertyName) {
            const property = properties[firstPropertyName];
            if (property) {
              if (property.title) {
                initialInputPlaceholder = property.title;
              }

              if (property.default) {
                initialInputValue = property.default;
              }
            }
          }
        }

        if (initialInputPlaceholder === "") {
          initialInputPlaceholder = "Please enter a value";
        }
      }

      let content: HTMLTemplateResult | symbol = nothing;

      if (!initialInputEnabled) {
        if (topEvent?.type === "secret") {
          content = html`<form @submit=${handleForm}>
            <input type="hidden" name="id" .value=${topEvent.keys.join(",")} />
            <input
              type="password"
              name="secret"
              placeholder=${topEvent.keys.join(",")}
            />
            <input type="submit" />
          </form>`;
        }

        if (topEvent?.type === "node" && !topEvent.hidden) {
          const nodeType = topEvent.node.descriptor.type;
          if (nodeType === "output") {
            this.#outputs.set(topEvent.id, topEvent.inputs);
          } else if (nodeType === "input") {
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
                ${this.#createInput(properties)}
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
      }

      return html` <main
        @pointerdown=${() => {
          this.showNav = false;
        }}
      >
        <app-nav .visible=${this.showNav}></app-nav>
        <header>
          <h1 id="board-title">
            <button
              id="show-nav"
              @click=${() => {
                this.showNav = true;
              }}
            >
              Navigation Menu
            </button>
            ${title || "Untitled board"}
          </h1>
          <form @submit=${handleForm}>
            <input type="hidden" name="initial-input" value="yes" />
            <input type="hidden" name="id" value="input" />
            <input
              name="initial-input-value"
              required
              placeholder="${initialInputPlaceholder}"
              autocomplete="off"
              ?disabled=${!initialInputEnabled}
              type="text"
              .value=${initialInputValue}
            />
            <input type="submit" />
          </form>
        </header>
        <section>
          <div
            id="progress"
            class=${classMap({
              start: isAtStart,
              active: !isAtStart && this.status === STATUS.RUNNING,
            })}
          >
            ${progressMessage ?? nothing}
          </div>
          <div id="content" ${ref(this.#contentRef)}>
            ${content}

            <!-- Outputs -->
            ${map(this.#outputs, ([id, outputs]) => {
              return this.#handleOutput(outputs, id);
            })}
          </div>
        </section>
      </main>`;
    });

    return html`${until(loadData)}`;
  }
}
