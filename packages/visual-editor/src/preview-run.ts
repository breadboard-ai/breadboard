/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HarnessRunResult,
  RunConfig,
  run,
} from "@google-labs/breadboard/harness";
import { customElement, property, state } from "lit/decorators.js";
import { LitElement, PropertyValueMap, css, html, nothing } from "lit";
import * as BreadboardUI from "@breadboard-ai/shared-ui";
import {
  type InputValues,
  Kit,
  InspectableRunObserver,
  createRunObserver,
  InspectableRun,
  createLoader,
} from "@google-labs/breadboard";
import { InputResolveRequest } from "@google-labs/breadboard/remote";
import { FileSystemGraphProvider } from "./providers/file-system";
import { IDBGraphProvider } from "./providers/indexed-db";
import { SettingsStore } from "./data/settings-store.js";
import { until } from "lit/directives/until.js";

type inputCallback = (data: Record<string, unknown>) => void;

export const getBoardInfo = async (url: string) => {
  const providers = [
    IDBGraphProvider.instance(),
    FileSystemGraphProvider.instance(),
  ];

  await Promise.all(providers.map((provider) => provider.restore()));

  const loader = createLoader(providers);
  const base = new URL(window.location.href);
  const graph = await loader.load(url, { base });
  if (!graph) {
    // TODO: Better error handling, maybe a toast?
    throw new Error(`Unable to load graph: ${url}`);
  }
  const runner = graph;
  const { title, description, version } = runner;
  return { title, description, version };
};

@customElement("bb-preview-run")
export class PreviewRun extends LitElement {
  @property({ reflect: true })
  embed = false;

  @property()
  url: string = "";

  @property({ type: Array })
  kits: Kit[] = [];

  @property({ reflect: true })
  status = BreadboardUI.Types.STATUS.STOPPED;

  @state()
  boardInfo: Awaited<ReturnType<typeof getBoardInfo>> | null = null;

  @state()
  runs: InspectableRun[] | null = null;

  #runObserver: InspectableRunObserver = createRunObserver();
  #handlers: Map<string, inputCallback[]> = new Map();
  #providers = [
    FileSystemGraphProvider.instance(),
    IDBGraphProvider.instance(),
  ];
  // Single loader instance for all boards.
  #loader = createLoader(this.#providers);
  #settings = SettingsStore.instance();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      margin: 0;
      padding: 0;
      font-family: var(--bb-font-family);
      height: 100%;
      width: 100%;
      color: #1a1a1a;
      --padding: calc(var(--bb-grid-size) * 4);
    }

    main {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: auto;
      align-items: center;
      background: #fff;
    }

    header {
      height: 174px;
      background: #ebf5ff;
      border-bottom: 1px solid #c0dfff;
      width: 100%;
      z-index: 1;
    }

    header #masthead {
      height: 48px;
      background: #3399ff;
    }

    header #info {
      padding: var(--padding);
      max-width: 740px;
      margin: 0 auto;
    }

    header h1 {
      margin: 0 0 var(--bb-grid-size) 0;
      font-size: var(--bb-text-regular);
      font-weight: normal;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    header h2 {
      margin: 0 0 calc(var(--bb-grid-size) * 5) 0;
      font-size: var(--bb-text-small);
      font-weight: normal;
      color: #595959;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    #run {
      background: var(--bb-selected-color);
      color: #fff;
      border-radius: 20px;
      border: none;
      height: 32px;
      padding: 0 calc(var(--bb-grid-size) * 4);
    }

    #run[disabled] {
      opacity: 0.4;
    }

    bb-activity-log {
      flex: 1;
      width: 100%;
      max-width: 740px;
      scrollbar-color: var(--bb-ui-100) white;
    }
  `;

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ url: string }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("url")) {
      return;
    }

    getBoardInfo(this.url).then((info) => {
      this.boardInfo = info;
    });
  }

  #restored = false;
  async restoreProvidersAndSettingsIfNeeded() {
    if (this.#restored) {
      return;
    }

    this.#restored = true;
    const jobs = this.#providers.map((provider) => provider.restore());
    jobs.push(this.#settings.restore());
    await Promise.all(jobs);
  }

  async #runBoard() {
    if (!this.url) {
      return;
    }

    await this.restoreProvidersAndSettingsIfNeeded();

    const config: RunConfig = {
      url: this.url,
      kits: this.kits,
      diagnostics: true,
      loader: this.#loader,
      interactiveSecrets: true,
      inputs: BreadboardUI.Data.inputsFromSettings(this.#settings),
    };

    this.status = BreadboardUI.Types.STATUS.RUNNING;
    for await (const result of run(config)) {
      await this.#runObserver?.observe(result);
      this.requestUpdate();

      const answer = await this.#handleStateChange(result);

      if (answer) {
        await result.reply({ inputs: answer } as InputResolveRequest);
      }
    }
    this.status = BreadboardUI.Types.STATUS.STOPPED;
  }

  /**
   * Handler method for registering input.
   *
   * Handle a specific input ID and return a promise that resolves with the data received by the handler.
   *
   * @param {string} id - Associates a specific input handler with a unique identifier.
   *
   * @returns {Promise<InputValues>}
   */
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

  /**
   * Handler method for registering secret values.
   *
   * Asynchronously register handlers for a list of keys and
   * return a promise that resolves to an object mapping each key to its corresponding secret value.
   *
   * @param {string[]} keys - The keys for which secrets need to be
   * registered.
   *
   * @returns {Promise<InputValues>}
   */
  async #registerSecretsHandler(keys: string[]): Promise<InputValues> {
    const values = await Promise.all(
      keys.map((key) => {
        return new Promise<[string, unknown]>((resolve) => {
          const callback = ({ secret }: Record<string, unknown>) => {
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

  #loadBoardServerContents() {
    if (!this.url) {
      return nothing;
    }

    return html`${until(
      this.#runObserver.runs().then((runs) => {
        const currentRun = runs[0];
        const events = currentRun?.events || [];
        const eventPosition = events.length - 1;

        return html`<main>
          <header>
            <div id="masthead"></div>
            <div id="info">
              <h1 id="board-title">
                ${this.boardInfo?.title || "Untitled board"}
              </h1>
              <h2>${this.boardInfo?.description || "No board description"}</h2>
              <button
                id="run"
                ?disabled=${this.status === BreadboardUI.Types.STATUS.RUNNING}
                @click=${() => this.#runBoard()}
              >
                Run
              </button>
            </div>
          </header>
          <bb-activity-log
            logTitle="Activity"
            .settings=${this.#settings.values}
            .events=${events}
            .eventPosition=${eventPosition}
            @bbinputenter=${async (
              event: BreadboardUI.Events.InputEnterEvent
            ) => {
              const data = event.data;
              const handlers = this.#handlers.get(event.id) || [];
              if (handlers.length === 0) {
                console.warn(
                  `Received event for input(id="${event.id}") but no handlers were found`
                );
              }

              if (this.#settings) {
                const isSecret = "secret" in event.data;
                const shouldSaveSecrets =
                  this.#settings
                    .getSection(BreadboardUI.Types.SETTINGS_TYPE.GENERAL)
                    .items.get("Save Secrets")?.value || false;

                if (isSecret && shouldSaveSecrets) {
                  const name = event.id;
                  const value = event.data.secret as string;
                  const secrets = this.#settings.getSection(
                    BreadboardUI.Types.SETTINGS_TYPE.SECRETS
                  ).items;
                  let shouldSave = false;
                  if (secrets.has(event.id)) {
                    const settingsItem = secrets.get(event.id);
                    if (settingsItem && settingsItem.value !== value) {
                      settingsItem.value = value;
                      shouldSave = true;
                    }
                  } else {
                    secrets.set(name, { name, value });
                    shouldSave = true;
                  }

                  if (shouldSave) {
                    await this.#settings.save(this.#settings.values);
                  }
                }
              }

              for (const handler of handlers) {
                handler.call(null, data);
              }
            }}
            name="Board"
            slot="slot-0"
          ></bb-activity-log>
        </main>`;
      })
    )}`;
  }
}
