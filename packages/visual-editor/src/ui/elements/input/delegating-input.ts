/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { analyzeIsJsonSubSchema } from "@google-labs/breadboard-schema/subschema.js";
import { consume } from "@lit/context";
import { Task } from "@lit/task";
import type { JSONSchema4 } from "json-schema";
import { html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  InputPlugin,
  InputWidget,
} from "../../../plugins/input-plugin.js";
import {
  type Environment,
  environmentContext,
} from "../../contexts/environment.js";

type State =
  | { stage: "initial" }
  | { stage: "loading"; plugin: InputPlugin; cancel: AbortController }
  | { stage: "error"; error: string }
  | { stage: "loaded"; widget: InputWidget };

/**
 * An input widget which doesn't render anything directly, but instead matches
 * the current schema against the input widgets that are installed in our
 * environment, and instantiates one of those.
 */
@customElement("bb-delegating-input")
export class DelegatingInput
  extends LitElement
  implements InputWidget<unknown>
{
  @state()
  private _state: State = { stage: "initial" };

  #environment?: Environment;
  @consume({ context: environmentContext })
  private get _environment(): Environment | undefined {
    return this.#environment;
  }
  private set _environment(environment: Environment) {
    if (environment !== this.#environment) {
      this.#environment = environment;
      this._state = this.#maybeReset();
    }
  }

  #schema?: JSONSchema4;
  @property({ attribute: false })
  get schema(): JSONSchema4 | undefined {
    return this.#schema;
  }
  set schema(schema: JSONSchema4) {
    if (schema !== this.#schema) {
      this.#schema = schema;
      this._state = this.#maybeReset();
    }
  }

  #value: unknown;
  @property({ attribute: false })
  get value() {
    return this.#value;
  }
  set value(value: unknown) {
    this.#value = value;
    if (this._state.stage === "loaded") {
      this._state.widget.value = value;
    }
  }

  #maybeReset(): State {
    if (this._state.stage === "loading") {
      this._state.cancel.abort();
    }
    if (!this.#environment || !this.#schema) {
      return { stage: "initial" };
    }
  }

  override render() {
    switch (this._state.stage) {
      case "initial": {
        return nothing;
      }
      case "loading": {
        return html`<p>Loading ...</p>`;
      }
      case "error": {
        return html`<p>Error: ${this._state.error}</p>`;
      }
      case "loaded": {
        return this._state.widget;
      }
    }
    this._state satisfies never;
  }

  #delegateTask = new Task(this, {
    task: async (
      [schema, inputPlugin],
      { signal }
    ): Promise<InputWidget<unknown> | undefined> => {
      if (!schema) {
        return undefined;
      }
      if (!inputPlugin) {
        throw new Error(
          `<bb-delegating-input> could not find an input widget capable of ` +
            `handling schema: ${JSON.stringify(schema)}`
        );
      }
      return await this.#instantiateWidget(schema, inputPlugin, signal);
    },
    args: () =>
      [
        this.schema,
        this.#chooseBestMatchingPlugin(),
        this._environment,
      ] as const,
  });

  #chooseBestMatchingPlugin(): InputPlugin | undefined {
    if (!this.schema || !this._environment) {
      return undefined;
    }
    // TODO(aomarks) Performance of this search could be improved by
    // partitioning by the top-level "type" field. But note we have to account
    // for schema compositions like `{ anyOf: { ... } }`, so it's not so simple.
    for (const plugin of this._environment.plugins.input) {
      // TODO If there are ties, a good starting heuristic could be to prefer
      // the widget with the most narrowly defined schema, and a proxy for
      // that could simply be JSON.stringify(match.schema).length.
      if (
        analyzeIsJsonSubSchema(this.schema, plugin.match.schema).isSubSchema
      ) {
        return plugin;
      }
    }
  }

  async #instantiateWidget(
    schema: JSONSchema4,
    plugin: InputPlugin,
    signal: AbortSignal
  ): Promise<InputWidget> {
    await plugin.load?.(signal);
    const element = document.createElement(
      plugin.instantiate.customElementName
    ) as InputWidget;
    // TODO(aomarks) What if the value is updated from the outside after
    // instantiation? It doesn't matter as used right now, but might become a
    // problem.
    element.value = this.value;
    element.schema = schema;
    element.addEventListener(
      "bb-input-change",
      (event) => {
        this.#value = event.value;
        if (!event.composed || !event.bubbles) {
          // Our parent element won't receive the event unless we re-emit it.
          this.dispatchEvent(event);
        }
      },
      { signal }
    );
    return element;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-delegating-input": DelegatingInput;
  }
}
