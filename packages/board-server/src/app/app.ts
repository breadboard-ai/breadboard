/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, type PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import {
  BoardServerAPIKeyEnterEvent,
  InputEnterEvent,
  RunContextChangeEvent,
  SecretsEnterEvent,
} from "./events/events.js";
import {
  createDefaultDataStore,
  createLoader,
  type GraphDescriptor,
  type InputValues,
} from "@google-labs/breadboard";
import {
  createRunner,
  type HarnessRunner,
  type RunConfig,
} from "@google-labs/breadboard/harness";
import { STATUS, type UserMessage } from "./types/types.js";
import { until } from "lit/directives/until.js";
import { loadKits } from "./utils/kit-loader.js";

import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";
import TemplateKit from "@google-labs/template-kit";
import GeminiKit from "@google-labs/gemini-kit";
import AgentKit from "@google-labs/agent-kit";

import "@breadboard-ai/shared-ui";
import "./elements/elements.js";
import { LightObserver } from "./utils/light-observer.js";
import { toGuestKey as toGuestStorageKey } from "./utils/invite.js";

const BOARD_SERVER_KEY = "board-server-key";
const RUN_ON_BOARD_SERVER = "run-on-board-server";

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

const getRemoteURL = () => {
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/app$/, "api/run");
  return url.href;
};

/**
 * Get the API key from the URL or local storage.
 *
 * First, try to get the key from local storage. If it's not there, check the
 * URL. If the URL has a `key` parameter, use that.
 */
const getApiKey = (): string | null => {
  const url = new URL(window.location.href);
  const locallyStoredKey = globalThis.localStorage.getItem(BOARD_SERVER_KEY);
  if (locallyStoredKey) {
    return locallyStoredKey;
  }
  const guestStorageKey = toGuestStorageKey(url);
  if (guestStorageKey) {
    const guestKey = globalThis.localStorage.getItem(guestStorageKey);
    if (guestKey) {
      return guestKey;
    }
  }
  return url.searchParams.get("key") || null;
};

@customElement("bb-app-view")
export class AppView extends LitElement {
  @property({ reflect: true })
  url: string | null = null;

  @property({ reflect: true })
  version: string = "dev";

  @state()
  status = STATUS.STOPPED;

  @state()
  showMenu = false;

  @state()
  showServerKeyPopover = false;

  @state()
  statusMessage: string | null = null;

  @state()
  runOnBoardServer = false;

  @state()
  boardKeyNeeded = false;

  @state()
  boardServerKey: string | null = getApiKey();

  @state()
  secretsNeeded: string[] | null = null;

  #statusMessageTime: string | null = null;
  #loader = createLoader([]);
  #dataStore = createDefaultDataStore();
  #descriptorLoad: Promise<GraphDescriptor | null> = Promise.resolve(null);
  #kitLoad = loadKits([TemplateKit, Core, GeminiKit, JSONKit, AgentKit]);

  #isSharing = false;
  #abortController: AbortController | null = null;
  #runObserver: LightObserver | null = null;
  #runner: HarnessRunner | null = null;
  #runStartTime = 0;
  #message = randomMessage[Math.floor(Math.random() * randomMessage.length)]!;
  #formatter = new Intl.DateTimeFormat(navigator.languages, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

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

    #status .messages-received {
      color: var(--bb-neutral-500);
      margin-left: var(--bb-grid-size-4);
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

      #board-info {
        width: 100%;
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
    this.runOnBoardServer =
      globalThis.localStorage.getItem(RUN_ON_BOARD_SERVER) === "true";

    this.#maybeProcessInvite();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.stopRun();
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          url: string | null;
          runOnBoardServer: boolean;
          boardServerKey: string | null;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    if (changedProperties.has("url")) {
      this.#descriptorLoad = new Promise(async (resolve) => {
        if (!this.url) {
          resolve(null);
          return;
        }

        try {
          const response = await fetch(this.url);
          const graph = (await response.json()) as GraphDescriptor;
          document.title = `${`${graph.title} - ` ?? ""}Breadboard App View`;
          resolve(graph);
        } catch (err) {
          console.warn(err);
          resolve(null);
        }
      });
    }

    if (
      changedProperties.has("runOnBoardServer") ||
      changedProperties.has("boardServerKey")
    ) {
      if (this.runOnBoardServer) {
        this.boardKeyNeeded = this.boardServerKey === null;
      } else {
        this.boardKeyNeeded = false;
      }
    }
  }

  stopRun() {
    this.status = STATUS.STOPPED;

    this.#abortController?.abort();

    this.#runner = null;
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
      diagnostics: "top",
      store: this.#dataStore,
      interactiveSecrets: true,
      inputs: {
        model: "gemini-1.5-flash-latest",
      },
    };

    if (this.runOnBoardServer && this.boardServerKey) {
      config.remote = {
        url: getRemoteURL(),
        type: "http",
        key: this.boardServerKey,
      };
    }

    this.#runner = createRunner(config);

    this.#runObserver = new LightObserver(
      this.#runner,
      this.#abortController.signal
    );

    this.#dataStore.releaseAll();
    this.#dataStore.createGroup("run");

    this.#runner.addEventListener("end", () => {
      this.stopRun();
    });

    this.#runner.addEventListener("error", () => {
      this.requestUpdate();
      this.stopRun();
    });

    this.#runner.addEventListener("input", async () => {
      this.statusMessage = "Requesting user input";
      this.#statusMessageTime = null;
      this.requestUpdate();
    });

    this.#runner.addEventListener("nodeend", () => {
      this.statusMessage = null;
      this.#statusMessageTime = this.#formatter.format(Date.now());
      this.requestUpdate();
    });

    this.#runner.addEventListener("nodestart", (evt) => {
      this.statusMessage = evt.data.node.metadata?.description ?? null;
      this.#statusMessageTime = this.#formatter.format(Date.now());
      this.requestUpdate();
    });

    this.#runner.addEventListener("output", () => {
      this.requestUpdate();
    });

    this.#runner.addEventListener("pause", () => {
      this.status = STATUS.PAUSED;
    });

    this.#runner.addEventListener("resume", () => {
      this.status = STATUS.RUNNING;
    });

    this.#runner.addEventListener("secret", async () => {
      const keys = this.#runner?.secretKeys();
      const secretsKeysNeeded = structuredClone(keys);
      if (!secretsKeysNeeded) {
        this.secretsNeeded = null;
        return;
      }

      const allKnownSecrets: [string, string][] = [];
      for (let i = secretsKeysNeeded.length - 1; i >= 0; i--) {
        const secret = secretsKeysNeeded[i];
        if (!secret) {
          continue;
        }

        const storedSecret = this.#getSecret(secret);
        if (storedSecret) {
          allKnownSecrets.push([secret, storedSecret]);
          secretsKeysNeeded.splice(i, 1);
        }
      }

      if (secretsKeysNeeded.length === 0) {
        const knownSecrets = Object.fromEntries(allKnownSecrets);
        this.#runner?.run(knownSecrets);
      } else {
        this.secretsNeeded = secretsKeysNeeded;
      }
    });

    this.#runner.addEventListener("start", () => {
      this.status = STATUS.RUNNING;
      this.#runStartTime = Date.now();
    });

    this.#runner.run();
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

  #maybeProcessInvite() {
    const url = new URL(window.location.href);
    const invite = url.searchParams.get("invite");
    if (!invite) {
      return;
    }

    const guestStorageKey = toGuestStorageKey(url);
    if (!guestStorageKey) {
      return;
    }

    // update the URL to remove the invite without changing history
    url.searchParams.delete("invite");
    history.replaceState(null, "", url.toString());

    // store the invite as board-server-guest-key in local storage
    localStorage.setItem(guestStorageKey, invite);
  }

  #storeBoardServerKey(key: string) {
    globalThis.localStorage.setItem(BOARD_SERVER_KEY, key);
    this.boardServerKey = getApiKey();
  }

  #renderLoading() {
    return html`<div id="loading">Loading...</div>`;
  }

  #storeSecret(secret: string, value: string) {
    globalThis.localStorage.setItem(`SECRET_${secret}`, value);
  }

  #getSecret(secret: string) {
    return globalThis.localStorage.getItem(`SECRET_${secret}`);
  }

  #getSecrets(which: string[]): Record<string, string> {
    const secrets: Record<string, string> = {};
    for (const secret of which) {
      const storedSecret = globalThis.localStorage.getItem(`SECRET_${secret}`);
      if (!storedSecret) {
        this.#abortController?.abort("Secret required, aborting run.");
        throw new Error(
          `Unexpected error - looking for secret ${secret} but unable to find it in storage`
        );
      }

      secrets[secret] = storedSecret;
    }

    return secrets;
  }

  #toggleRunContext(evt: RunContextChangeEvent) {
    this.runOnBoardServer = evt.where === "remote";
    globalThis.localStorage.setItem(
      RUN_ON_BOARD_SERVER,
      `${this.runOnBoardServer}`
    );
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

    const log = this.#runObserver?.log() ?? [];
    const status = () => {
      const classes: Record<string, boolean> = { pending: false };
      const newest = log[log.length - 1];
      if (newest && (newest.type === "edge" || newest.type === "node")) {
        classes.pending = newest.end === null;
      }

      let message = html`Press "Start Activity" to begin`;
      if (this.status !== STATUS.STOPPED) {
        message = html`${this.statusMessage ?? "Working"}...`;
      }

      const lastUpdateTime = new Promise((resolve) => {
        setTimeout(resolve, 3000);
      }).then(() => {
        if (!this.#statusMessageTime || this.status === STATUS.STOPPED) {
          return nothing;
        }

        return html`<span class="messages-received"
          >Last update: ${this.#statusMessageTime}</span
        >`;
      });

      return html`<div id="status" class=${classMap(classes)}>
        ${message}${until(lastUpdateTime)}
      </div>`;
    };

    const active =
      this.status === STATUS.RUNNING || this.status === STATUS.PAUSED;

    const activity = Promise.all([this.#descriptorLoad, this.#kitLoad]).then(
      () => {
        return html`<bb-activity-log-lite
          .start=${this.#runStartTime}
          .message=${this.#message}
          .log=${log}
          @bbinputrequested=${() => {
            this.requestUpdate();
          }}
          @bbinputenter=${(event: InputEnterEvent) => {
            let data = event.data as InputValues;
            const runner = this.#runner;
            if (!runner) {
              throw new Error("Can't send input, no runner");
            }
            if (runner.running()) {
              throw new Error(
                "The runner is already running, cannot send input"
              );
            }
            runner.run(data);
          }}
        ></bb-activity-log-lite>`;
      }
    );

    const nav = (popout: boolean) => {
      return html`<bb-app-nav
        .popout=${popout}
        .runOnBoardServer=${this.runOnBoardServer}
        .boardKeyNeeded=${this.boardKeyNeeded}
        @bbdismissmenu=${() => {
          this.showMenu = false;
        }}
        @bbruncontextchange=${this.#toggleRunContext}
        @bbshare=${this.#share}
        @bbserverkeyrequest=${() => {
          this.showServerKeyPopover = true;
        }}
        ?visible=${popout && this.showMenu}
      ></bb-app-nav>`;
    };

    const inert =
      this.secretsNeeded || this.showMenu || this.showServerKeyPopover;

    return html` <main ?inert=${inert}>
        ${nav(true)}
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
            ${nav(false)}
          </div>
        </section>
        <section id="activity-container" ?inert=${this.showMenu}>
          <div id="activity">${until(activity)}</div>
        </section>
      </main>

      ${this.secretsNeeded
        ? html`<bb-secret-requester
            .secrets=${this.secretsNeeded}
            @bbsekrits=${(evt: SecretsEnterEvent) => {
              for (const [name, secret] of Object.entries(evt.sekrits)) {
                this.#storeSecret(name, secret);
              }

              const secrets = this.#getSecrets(this.secretsNeeded ?? []);
              this.secretsNeeded = null;
              this.#runner?.run(secrets);
            }}
          ></bb-secret-requester>`
        : nothing}
      ${this.showServerKeyPopover
        ? html`<bb-board-server-key
            .key=${this.boardServerKey}
            @bboverlaydismiss=${() => {
              this.showServerKeyPopover = false;
            }}
            @bbserverkeyenter=${(evt: BoardServerAPIKeyEnterEvent) => {
              this.#storeBoardServerKey(evt.key);
              this.showServerKeyPopover = false;
            }}
          ></bb-board-server-key>`
        : nothing}

      <footer ?inert=${inert}>
        <div id="links">
          Created with
          <a href="https://breadboard-ai.github.io/breadboard/">Breadboard</a>
          by <a href="https://labs.google/">Google labs</a> - v${this.version}
        </div>
        <div id="controls">
          ${status()}
          <button
            id="main-control"
            class=${classMap({ active })}
            @click=${async () => {
              if (
                this.status === STATUS.RUNNING ||
                this.status === STATUS.PAUSED
              ) {
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
