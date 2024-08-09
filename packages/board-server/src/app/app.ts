/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, type PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { InputEnterEvent } from "./events/events.js";
import {
  createLoader,
  createRunObserver,
  type GraphDescriptor,
  type InputValues,
  type InspectableRun,
  type InspectableRunObserver,
  type NodeValue,
} from "@google-labs/breadboard";
import {
  createRunner,
  type RunConfig,
  type RunNodeStartEvent,
} from "@google-labs/breadboard/harness";
import { type InputCallback, STATUS, type UserMessage } from "./types/types.js";
import { until } from "lit/directives/until.js";
import { loadKits } from "./utils/kit-loader.js";

import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import GeminiKit from "@google-labs/gemini-kit";
import AgentKit from "@google-labs/agent-kit";

import "@breadboard-ai/shared-ui";
import "./elements/elements.js";

const randomMessage: UserMessage[] = [
  {
    srcset: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f648/512.webp",
    src: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f648/512.gif",
    alt: "🙈",
  },
  {
    srcset:
      "https://fonts.gstatic.com/s/e/notoemoji/latest/1f636_200d_1f32b_fe0f/512.webp",
    src: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f636_200d_1f32b_fe0f/512.gif",
    alt: "😶",
  },
  {
    srcset: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f9d0/512.webp",
    src: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f9d0/512.gif",
    alt: "🧐",
  },
  {
    srcset: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a1/512.webp",
    src: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a1/512.gif",
    alt: "💡",
  },
];

@customElement("bb-app-view")
export class AppView extends LitElement {
  @property({ reflect: true })
  url: string | null = null;

  @property({ reflect: true })
  version: string = "dev";

  @state()
  status = STATUS.STOPPED;

  @state()
  runs: InspectableRun[] | null = null;

  @state()
  showMenu = false;

  #loader = createLoader([]);
  #descriptorLoad: Promise<GraphDescriptor | null> = Promise.resolve(null);
  #kitLoad = loadKits([TemplateKit, Core, GeminiKit, JSONKit, AgentKit]);

  #isSharing = false;
  #handlers: Map<string, InputCallback[]> = new Map();
  #abortController: AbortController | null = null;
  #runObserver: InspectableRunObserver | null = null;
  #runStartTime = 0;
  #message = randomMessage[Math.floor(Math.random() * randomMessage.length)]!;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      font: var(--bb-font-body-medium);
      height: 100%;
    }

    main {
      display: grid;
      grid-template-columns: none;
      grid-template-rows: 48px auto;
    }

    #loading {
      padding: var(--bb-grid-size-4);
      display: flex;
      align-items: center;
    }

    #loading::before {
      content: "";
      width: 16px;
      height: 16px;
      background: transparent url(/images/progress-ui.svg) 0 center / 16px 16px
        no-repeat;
      margin-right: var(--bb-grid-size);
    }

    #board-description {
      display: none;
      color: var(--bb-neutral-600);
    }

    header {
      display: flex;
      align-items: center;
    }

    #menu-toggle {
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-menu-inverted) center center / 20px
        20px no-repeat;
      border: none;
      font-size: 0;
      margin-right: var(--bb-grid-size-2);
    }

    h1 {
      font: var(--bb-font-title-small);
      margin: 0;
    }

    p {
      margin: 0 0 var(--bb-grid-size-2) 0;
    }

    footer {
      position: fixed;
      bottom: 0;
      height: calc(var(--bb-grid-size-13) + var(--bb-grid-size-12));
      display: grid;
      grid-template-columns: none;
      grid-template-rows: var(--bb-grid-size-13) var(--bb-grid-size-8);
      background: var(--bb-neutral-0);
      border-top: 1px solid var(--bb-neutral-300);
      width: 100%;
      font: var(--bb-font-body-small);
      align-items: center;
    }

    #links {
      color: var(--bb-neutral-400);
      grid-row: 2/3;
      padding: 0 var(--bb-grid-size-2);
    }

    #links a {
      color: var(--bb-neutral-500);
      font-weight: bold;
      text-decoration: none;
    }

    #controls {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      justify-content: space-between;
      background: var(--bb-neutral-0);
      z-index: 1;
    }

    #status {
      max-width: calc(100vw - 160px);
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 var(--bb-grid-size-2);
      font: var(--bb-font-title-small);
      color: var(--bb-neutral-700);
    }

    #status.pending {
      padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-8);
      background: transparent url(/images/progress-ui.svg) var(--bb-grid-size-2)
        center / 16px 16px no-repeat;
    }

    #main-control {
      height: 32px;
      background: var(--bb-ui-500);
      border-radius: 30px;
      padding: var(--bb-grid-size) var(--bb-grid-size-5);
      border: 1px solid var(--bb-ui-500);
      color: var(--bb-neutral-0);
      flex: 0 0 auto;
      margin: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size-3);
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #main-control:hover,
    #main-control:focus {
      background: var(--bb-ui-600);
      transition-duration: 0.15s;
    }

    #main-control.active {
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-ui-200);
      color: var(--bb-ui-600);
    }

    #main-control.active:hover,
    #main-control.active:focus {
      background: var(--bb-ui-50);
      transition-duration: 0.15s;
    }

    #board-info h1 {
      color: var(--bb-neutral-0);
    }

    #board-info bb-app-nav {
      display: none;
    }

    #board-info-container {
      display: flex;
      align-items: center;
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      background: var(--bb-ui-500);
    }

    @media (min-width: 700px) {
      main {
        display: grid;
        grid-template-columns: max(300px, 20vw) 1fr;
        grid-template-rows: none;
        column-gap: var(--bb-grid-size-5);
      }

      #board-info-container {
        background: var(--bb-neutral-0);
        border-bottom: 1px solid var(--bb-neutral-300);
      }

      #board-info h1 {
        color: var(--bb-ui-500);
      }

      #menu-toggle {
        background-image: var(--bb-icon-menu);
      }

      footer {
        height: var(--bb-grid-size-13);
        grid-template-columns: max(300px, 20vw) 1fr;
        grid-template-rows: none;
        column-gap: var(--bb-grid-size-5);
      }

      #links {
        grid-row: auto;
        padding-left: var(--bb-grid-size-4);
      }

      #status {
        max-width: calc(100vw - 180px - max(300px, 20vw));
      }

      h1 {
        font: var(--bb-font-title-large);
        margin: 0;
      }

      section {
        display: block;
      }

      #activity {
        position: relative;
      }

      #board-info {
        position: sticky;
        top: 0;
        padding: 0;
        background: var(--bb-neutral-0);
      }

      #board-info bb-app-nav {
        display: block;
      }

      #board-info #menu-toggle {
        display: none;
      }

      #board-info-container {
        align-items: flex-start;
        border-bottom: none;
        padding: 0;
      }

      #board-description {
        display: block;
        margin-top: var(--bb-grid-size-2);
        padding: 0 var(--bb-grid-size-4);
      }

      #board-info h1 {
        padding: var(--bb-grid-size-5) var(--bb-grid-size-4) 0
          var(--bb-grid-size-4);
      }
    }

    @media (min-width: 1120px) {
      #activity,
      #controls {
        width: 750px;
        left: calc(50% - 250px - (max(300px, 20vw) / 2));
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    this.url = window.location.pathname.replace(/app$/, "json");
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.stopRun();
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ url: string }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("url")) {
      return;
    }

    this.#descriptorLoad = new Promise(async (resolve) => {
      if (!this.url) {
        resolve(null);
        return;
      }

      try {
        const response = await fetch(this.url);
        const graph = (await response.json()) as GraphDescriptor;
        resolve(graph);
      } catch (err) {
        console.warn(err);
        resolve(null);
      }
    });
  }

  stopRun() {
    if (!this.#abortController) {
      return;
    }

    this.#abortController.abort();
    this.#callAllPendingInputHandlers();
  }

  async startRun() {
    this.stopRun();

    const [graph, kits] = await Promise.all([
      this.#descriptorLoad,
      this.#kitLoad,
    ]);

    if (!graph || !kits || !this.url) {
      return;
    }

    this.#abortController = new AbortController();

    const config: RunConfig = {
      url: this.url,
      kits,
      runner: graph,
      loader: this.#loader,
      signal: this.#abortController.signal,
      diagnostics: true,
      interactiveSecrets: true,
      inputs: {
        model: "gemini-1.5-flash-latest",
      },
    };

    if (!this.#runObserver) {
      this.#runObserver = createRunObserver({ kits, logLevel: "debug" });
    }

    const runner = createRunner(config);
    runner.addEventListener("end", () => {
      this.status = STATUS.STOPPED;
    });

    runner.addEventListener("error", (evt) => {
      this.requestUpdate();
      this.status = STATUS.STOPPED;
    });

    runner.addEventListener("input", async (evt) => {
      const value = await this.#registerInputHandler(evt.data.node.id);
      await runner.run(value);
    });

    runner.addEventListener("nodeend", (evt) => {
      this.requestUpdate();
      this.#handlers.delete(evt.data.node.id);
    });

    runner.addEventListener("nodestart", (evt) => {
      this.requestUpdate();
      if (!this.#handlers.has(evt.data.node.id)) {
        this.#handlers.set(evt.data.node.id, []);
      }
    });

    runner.addEventListener("output", (evt) => {
      this.requestUpdate();
    });

    runner.addEventListener("pause", () => {
      this.status = STATUS.PAUSED;
    });

    runner.addEventListener("resume", () => {
      this.status = STATUS.RUNNING;
    });

    runner.addEventListener("secret", async (evt) => {
      this.requestUpdate();

      const secrets = await this.#registerSecretsHandler(evt.data.keys);
      await runner.run(secrets);
    });

    runner.addEventListener("start", () => {
      this.status = STATUS.RUNNING;
      this.#runStartTime = Date.now();
    });

    runner.addObserver(this.#runObserver);
    runner.run();
  }

  async #registerInputHandler(id: string): Promise<InputValues> {
    const handlers = this.#handlers.get(id);
    if (!handlers) {
      return Promise.reject(`Unable to set up handler for input ${id}`);
    }

    return new Promise((resolve) => {
      handlers.push((data: InputValues) => {
        resolve(data);
      });
    });
  }

  async #registerSecretsHandler(keys: string[]): Promise<InputValues> {
    const values = await Promise.all(
      keys.map((key) => {
        return new Promise<[string, NodeValue]>((resolve) => {
          const callback = ({ secret }: InputValues) => {
            resolve([key, secret]);
          };
          this.#handlers.set(key, [callback]);
        });
      })
    );

    return Object.fromEntries(values);
  }

  #callAllPendingInputHandlers() {
    for (const handlers of this.#handlers.values()) {
      for (const handler of handlers) {
        handler.call(null, {});
      }
    }
  }

  async #share() {
    if (this.#isSharing) {
      return;
    }

    const graph = await this.#descriptorLoad;
    if (!graph) {
      return;
    }

    const opts: Partial<ShareData> = {
      url: window.location.href,
    };

    if (graph.title) {
      opts.title = graph.title;
    }

    if (graph.description) {
      opts.text = graph.description;
    }

    await navigator.share(opts);
    this.#isSharing = false;
  }

  #renderLoading() {
    return html`<div id="loading">Loading...</div>`;
  }

  render() {
    const boardTitle = Promise.all([this.#descriptorLoad, this.#kitLoad]).then(
      ([graph, kits]) => {
        if (!graph || !kits) {
          return html`Failed to load`;
        }

        return html`${graph.title}`;
      }
    );

    const boardDescription = Promise.all([
      this.#descriptorLoad,
      this.#kitLoad,
    ]).then(([graph, kits]) => {
      if (!graph || !kits) {
        return html`Failed to load`;
      }

      return graph.description ? html`${graph.description}` : nothing;
    });

    const runs = this.#runObserver
      ? this.#runObserver.runs()
      : Promise.resolve([]);

    const status = runs.then((runs) => {
      const currentRun = runs[0];
      const events = currentRun?.events ?? [];

      const classes: Record<string, boolean> = { pending: false };

      let message = 'Press "Start Activity" to begin';
      if (events.length && this.status !== STATUS.STOPPED) {
        const newest = events[events.length - 1];
        if (newest && newest.type === "node") {
          if (newest.node.descriptor.type === "input") {
            classes.pending = true;
            message = "Requesting user input...";
          } else {
            classes.pending = true;
            const details =
              newest.node.descriptor.metadata?.description ?? "Working...";
            message = `${details} (${events.length} event${events.length === 1 ? "" : "s"} received)`;
          }
        }
      }

      return html`<div id="status" class=${classMap(classes)}>
        ${until(message)}
      </div>`;
    });

    const active =
      this.status === STATUS.RUNNING || this.status === STATUS.PAUSED;

    const activity = Promise.all([
      this.#descriptorLoad,
      this.#kitLoad,
      runs,
    ]).then(([, , runs]) => {
      const currentRun = runs[0];
      const events = currentRun?.events ?? [];

      return html`<bb-activity-log-lite
        .start=${this.#runStartTime}
        .message=${this.#message}
        .events=${events}
        @bbinputrequested=${() => {
          this.requestUpdate();
        }}
        @bbinputenter=${(event: InputEnterEvent) => {
          const data = event.data as InputValues;
          const handlers = this.#handlers.get(event.id) || [];
          if (handlers.length === 0) {
            console.warn(
              `Received event for input(id="${event.id}") but no handlers were found`
            );
          }

          if (
            event.allowSavingIfSecret &&
            typeof event.data.secret === "string"
          ) {
            globalThis.localStorage.setItem(event.id, event.data.secret);
          }

          for (const handler of handlers) {
            handler.call(null, data);
          }
        }}
      ></bb-activity-log-lite>`;
    });

    return html` <main>
        <bb-app-nav
          .popout=${true}
          @bbdismissmenu=${() => {
            this.showMenu = false;
          }}
          @bbshare=${this.#share}
          ?visible=${this.showMenu}
        ></bb-app-nav>
        <section id="board-info-container">
          <div id="board-info">
            <header>
              <button
                id="menu-toggle"
                @click=${() => {
                  this.showMenu = true;
                }}
              >
                ${this.showMenu ? "Hide Menu" : "Show Menu"}
              </button>
              <h1>${until(boardTitle, this.#renderLoading())}</h1>
            </header>
            <p id="board-description">${until(boardDescription)}</p>
            <bb-app-nav .popout=${false} @bbshare=${this.#share}></bb-app-nav>
          </div>
        </section>
        <section id="activity-container" ?inert=${this.showMenu}>
          <div id="activity">${until(activity)}</div>
        </section>
      </main>
      <footer>
        <div id="links">
          Created with
          <a href="https://breadboard-ai.github.io/breadboard/">Breadboard</a>
          by <a href="https://labs.google/">Google labs</a> - v${this.version}
        </div>
        <div id="controls">
          ${until(status)}
          <button
            id="main-control"
            class=${classMap({ active })}
            @click=${async () => {
              if (this.status === STATUS.RUNNING) {
                this.stopRun();
                return;
              }

              // Set the component running, then request an update so that
              // the button updates. When the component is finished, render
              // the button again.
              const running = this.startRun();
              requestAnimationFrame(() => {
                this.requestUpdate();
              });
              await running;
              this.requestUpdate();
            }}
          >
            ${active ? "Stop Activity" : "Start Activity"}
          </button>
        </div>
      </footer>`;
  }
}
