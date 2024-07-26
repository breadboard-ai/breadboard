/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { InputEnterEvent } from "../../events/events.js";
import {
  BoardRunner,
  createRunObserver,
  DataStore,
  GraphDescriptor,
  GraphLoader,
  InspectableRun,
  InspectableRunObserver,
  Kit,
} from "@google-labs/breadboard";
import { HarnessRunResult, run } from "@google-labs/breadboard/harness";
import { InputResolveRequest } from "@google-labs/breadboard/remote";
import { InputCallback, STATUS } from "../../types/types.js";
import { getIsolatedNodeGraphDescriptor } from "../../utils/isolated-node-board.js";
import { inputsFromSettings } from "../../../data/inputs.js";
import { SettingsStore } from "../../../data/settings-store.js";

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

  @property()
  dataStore: DataStore | null = null;

  #isolatedNodeGraphDescriptor: Promise<GraphDescriptor | null> | null = null;
  #handlers: Map<string, InputCallback[]> = new Map();
  #runObserver: InspectableRunObserver | null = null;
  #abortController: AbortController | null = null;

  static styles = css`
    :host {
      display: block;
      margin-bottom: var(--bb-grid-size-8);
    }
  `;

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

    const boardRunner = await BoardRunner.fromGraphDescriptor(descriptor);
    this.#abortController = new AbortController();

    const runner = run({
      url: window.location.href,
      kits: this.kits,
      runner: boardRunner,
      loader: this.loader ?? undefined,
      signal: this.#abortController.signal,
      diagnostics: true,
      inputs: inputsFromSettings(this.settings),
      interactiveSecrets: true,
    });

    if (!this.#runObserver) {
      this.#runObserver = createRunObserver({
        logLevel: "debug",
        store: this.dataStore ?? undefined,
      });
    }

    this.status = STATUS.RUNNING;
    for await (const result of runner) {
      try {
        // Update "runs" to ensure the UI is aware when the new run begins.
        this.runs = await this.#runObserver.observe(result);
      } catch (err) {
        // TODO: Do we need to output an error here?
        break;
      }

      const answer = await this.#handleStateChange(result);
      if (answer) {
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

    const runs = this.#runObserver?.runs();
    const currentRun = runs?.[0] ?? null;
    const events = currentRun?.events ?? [];
    const eventPosition = events.length - 1;

    return html`<bb-activity-log
      .run=${currentRun}
      .events=${events}
      .eventPosition=${eventPosition}
      .showExtendedInfo=${true}
      .logTitle=${"Test Component"}
      .waitingMessage=${'Click "Run Component" to get started'}
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
  }
}
