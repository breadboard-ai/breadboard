/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { InputEnterEvent } from "../../events/events.js";
import {
  createGraphStore,
  createRunObserver,
  GraphDescriptor,
  GraphLoader,
  GraphStoreArgs,
  InspectableRun,
  InspectableRunObserver,
  Kit,
} from "@google-labs/breadboard";
import { HarnessRunResult, run } from "@google-labs/breadboard/harness";
import { InputResolveRequest } from "@google-labs/breadboard/remote";
import { InputCallback, STATUS } from "../../types/types.js";
import { getIsolatedNodeGraphDescriptor } from "../../utils/isolated-node-board.js";
import { inputsFromSettings } from "../../data/inputs.js";
import { SettingsStore } from "../../types/types.js";
import { until } from "lit/directives/until.js";
import { classMap } from "lit/directives/class-map.js";

const STORAGE_PREFIX = "bb-node-runner";

@customElement("bb-node-runner")
export class NodeRunner extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  settings: SettingsStore | null = null;

  @property()
  status = STATUS.STOPPED;

  @property()
  selectedNodeIds: string[] = [];

  @property()
  runs: InspectableRun[] | null = null;

  @property()
  loader: GraphLoader | null = null;

  @property()
  kits: Kit[] = [];

  @state()
  expanded = false;

  #isolatedNodeGraphDescriptor: Promise<GraphDescriptor | null> | null = null;
  #handlers: Map<string, InputCallback[]> = new Map();
  #runObserver: InspectableRunObserver | null = null;
  #abortController: AbortController | null = null;

  static styles = css`
    :host {
      display: block;
      margin-bottom: var(--bb-grid-size-8);
      border-top: 1px solid var(--bb-neutral-300);
    }

    #activity {
      display: none;
    }

    #activity.visible {
      display: block;
    }

    #activity p {
      color: var(--bb-neutral-700);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      padding: 0px;
      margin: 0 0 var(--bb-grid-size-2) 0;
      padding: 0 var(--bb-grid-size-4);
    }

    h1 {
      width: 100%;
      display: flex;
      align-items: center;
      border: none;
      background: #fff;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: 0;
      text-align: left;
      position: sticky;
      margin: 0 0 var(--bb-grid-size) 0;
      top: 0;
      z-index: 2;
    }

    #test-component {
      padding: var(--bb-grid-size) var(--bb-grid-size-2) var(--bb-grid-size)
        var(--bb-grid-size-7);
      background: var(--bb-neutral-100) var(--bb-icon-experiment) 4px center /
        20px 20px no-repeat;
      display: inline-flex;
      border-radius: 50px;
      height: 24px;
      align-items: center;
      text-decoration: none;
      color: var(--bb-neutral-800);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: none;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
      cursor: pointer;
      margin-bottom: var(--bb-grid-size-3);
    }

    #test-component:hover {
      background-color: var(--bb-neutral-200);
      transition-duration: 0.1s;
    }

    #unfold {
      cursor: pointer;
      width: 100%;
      display: grid;
      grid-template-columns: auto min-content;
      align-items: center;
      border: none;
      background: #fff;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      text-align: left;
    }

    #unfold::after {
      content: "";
      width: 20px;
      height: 20px;
      background: #fff var(--bb-icon-unfold-more) center center / 20px 20px
        no-repeat;
      justify-self: end;
    }

    #unfold.visible::after {
      background: #fff var(--bb-icon-unfold-less) center center / 20px 20px
        no-repeat;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    const isExpanded = globalThis.sessionStorage.getItem(
      `${STORAGE_PREFIX}-expanded`
    );

    this.expanded = isExpanded === "true";
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.stopComponent();
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          graph: GraphDescriptor | null;
          selectedNodeIds: string[];
        }>
      | Map<PropertyKey, unknown>
  ): void {
    if (
      !changedProperties.has("graph") &&
      !changedProperties.has("selectedNodeIds")
    ) {
      return;
    }

    if (
      !this.graph ||
      !this.selectedNodeIds ||
      this.selectedNodeIds.length !== 1
    ) {
      this.#isolatedNodeGraphDescriptor = null;
      return;
    }

    this.#isolatedNodeGraphDescriptor = getIsolatedNodeGraphDescriptor(
      this.graph,
      this.kits,
      this.loader ?? undefined,
      this.selectedNodeIds[0]
    );
  }

  stopComponent() {
    if (!this.#abortController) {
      return;
    }

    this.#runObserver = null;
    this.#abortController.abort();
    this.#callAllPendingInputHandlers();
  }

  async runComponent() {
    this.stopComponent();

    if (!this.graph) {
      return;
    }

    const descriptor = await this.#isolatedNodeGraphDescriptor;
    if (!descriptor) {
      return;
    }

    this.#abortController = new AbortController();

    const runner = run({
      url: window.location.href,
      kits: this.kits,
      runner: descriptor,
      loader: this.loader ?? undefined,
      signal: this.#abortController.signal,
      diagnostics: true,
      interactiveSecrets: true,
      inputs: inputsFromSettings(this.settings),
    });

    if (!this.#runObserver) {
      // This is wrong, but we don't use this component at the moment.
      // We shouldn't create a new GraphStore instance here.
      // TODO: Pass the graph store from components above?
      const store = createGraphStore({} as GraphStoreArgs);
      this.#runObserver = createRunObserver(store, {
        logLevel: "debug",
        skipDataStore: true,
      });
    }

    this.status = STATUS.RUNNING;
    for await (const result of runner) {
      try {
        await this.#runObserver.observe(result);
        this.requestUpdate();
      } catch (err) {
        // TODO: Do we need to output an error here?
        break;
      }

      const answer = await this.#handleStateChange(result);
      if (answer) {
        // Backfill any missing inputs with default values (if they exist in the
        // schema).
        if (result.type === "input") {
          const properties =
            result.data.inputArguments.schema?.properties ?? {};
          const expectedInputs = Object.keys(properties);

          for (const input of expectedInputs) {
            if (!answer[input]) {
              if (properties[input].default) {
                if (
                  (properties[input].type === "array" ||
                    properties[input].type === "object") &&
                  typeof properties[input].default === "string"
                ) {
                  try {
                    answer[input] = JSON.parse(properties[input].default);
                  } catch (err) {
                    // Best effort attempt to apply the default - warn in the console.
                    console.warn(`Unable to apply default value to ${input}`);
                    console.warn(err);
                  }
                } else {
                  // Apply as-is for most defaults.
                  answer[input] = properties[input].default;
                }
              }
            }
          }
        }

        await result.reply({ inputs: answer } as InputResolveRequest);
      }
    }

    this.status = STATUS.STOPPED;
  }

  async #registerInputHandler(id: string): Promise<Record<string, unknown>> {
    const handlers = this.#handlers.get(id);
    if (!handlers) {
      return Promise.reject(`Unable to set up handler for input ${id}`);
    }

    return new Promise((resolve) => {
      handlers.push((data: Record<string, unknown>) => {
        resolve(data);
      });
    });
  }

  async #registerSecretsHandler(
    keys: string[]
  ): Promise<Record<string, unknown>> {
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

    return Object.fromEntries(values);
  }

  async #handleStateChange(
    message: HarnessRunResult
  ): Promise<Record<string, unknown> | void> {
    this.requestUpdate();

    const { data, type } = message;
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

  #callAllPendingInputHandlers() {
    for (const handlers of this.#handlers.values()) {
      for (const handler of handlers) {
        handler.call(null, {});
      }
    }
  }

  render() {
    if (!this.#isolatedNodeGraphDescriptor) {
      return nothing;
    }

    let runs: Promise<InspectableRun[]> = Promise.resolve([]);
    if (this.#runObserver) {
      runs = this.#runObserver?.runs();
    }

    const instruction = "Run Component";
    const runInfo = runs.then((runInfo) => {
      const currentRun = runInfo?.[0] ?? null;
      const events = currentRun?.events ?? [];
      const eventPosition = events.length - 1;
      return html`<bb-activity-log
        .run=${currentRun}
        .events=${events}
        .eventPosition=${eventPosition}
        .showExtendedInfo=${true}
        .logTitle=${instruction}
        .showLogTitle=${false}
        .waitingMessage=${`Click "${instruction}" to get started`}
        .settings=${this.settings}
        @bbinputrequested=${() => {
          this.requestUpdate();
        }}
        @bbinputenter=${(event: InputEnterEvent) => {
          const data = event.data;
          const handlers = this.#handlers.get(event.id) || [];
          if (handlers.length === 0) {
            console.warn(
              `Received event for input(id="${event.id}") but no handlers were found`
            );
          }
          for (const handler of handlers) {
            handler.call(null, data);
          }
        }}
        name="Board"
      ></bb-activity-log>`;
    });

    return html`<h1>
        <button
          id="unfold"
          class=${classMap({ visible: this.expanded })}
          @click=${() => {
            this.expanded = !this.expanded;

            globalThis.sessionStorage.setItem(
              `${STORAGE_PREFIX}-expanded`,
              this.expanded.toString()
            );
          }}
        >
          Test Component
        </button>
      </h1>
      <div id="activity" class=${classMap({ visible: this.expanded })}>
        <p>
          Try out the component in isolation using its current configuration
        </p>
        <p>
          <button
            @click=${async () => {
              if (this.status === STATUS.RUNNING) {
                this.stopComponent();
                return;
              }

              // Set the component running, then request an update so that
              // the button updates. When the component is finished, render
              // the button again.
              const running = this.runComponent();
              requestAnimationFrame(() => {
                this.requestUpdate();
              });
              await running;
              this.requestUpdate();
            }}
            id="test-component"
          >
            ${this.status === STATUS.RUNNING ? "Stop Component" : instruction}
          </button>
        </p>

        ${until(runInfo)}
      </div>`;
  }
}
