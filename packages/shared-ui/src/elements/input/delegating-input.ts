/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { analyzeIsJsonSubSchema } from "@google-labs/breadboard-schema/subschema.js";
import { consume } from "@lit/context";
import { Task } from "@lit/task";
import type { JSONSchema4 } from "json-schema";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  type Environment,
  environmentContext,
} from "../../contexts/environment.js";
import type {
  InputChangeEvent,
  InputPlugin,
  InputWidget,
} from "../../plugins/input-plugin.js";
import { Schema } from "@google-labs/breadboard";

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
  @property({ attribute: false })
  accessor schema: JSONSchema4 | undefined = undefined;

  @property()
  accessor metadata: Record<string, unknown> | undefined = undefined;

  // See #onChange for why we maintain a private #value shadow.
  #value: unknown;
  get value(): unknown {
    return this.#value;
  }
  @property({ attribute: false })
  set value(value: unknown) {
    this.#value = value;
  }

  @consume({ context: environmentContext })
  private accessor _environment!: Environment;

  /**
   * This first task chooses the best plugin and instantiates the inner widget
   * element.
   */
  #widgetIgnoringValue = new Task(this, {
    args: () => [this.schema, this._environment] as const,
    task: ([schema, environment], { signal }) => {
      if (!schema || !environment) {
        return undefined;
      }
      const plugin = chooseBestPlugin(schema, environment);
      if (!plugin) {
        throw new Error(
          `<bb-delegating-input> could not find an input widget capable of ` +
            `handling schema: ${JSON.stringify(schema)}`
        );
      }
      return this.#instantiateWidget(plugin, schema, signal);
    },
  });

  /**
   * This second task propagates any values set from our parent down to the
   * inner widget element.
   *
   * Note this is a separate task from #widgetIgnoringValue so that when it's
   * only the value that changed, we don't re-instantiate the element.
   */
  #widget = new Task(this, {
    args: () => [this.#widgetIgnoringValue.value, this.#value] as const,
    task: ([widget, value]) => {
      if (widget) {
        widget.value = value;
      }
      return widget;
    },
  });

  override render() {
    return this.#widget.render({
      pending: () => html`<p>Loading input...</p>`,
      error: (error) => html`<p>Error delegating to input: ${error}</p>`,
      complete: (widget) => widget,
    });
  }

  async #instantiateWidget(
    plugin: InputPlugin,
    schema: JSONSchema4,
    signal: AbortSignal
  ): Promise<InputWidget | undefined> {
    await plugin.load?.(signal);
    if (signal.aborted) {
      return undefined;
    }
    const element = document.createElement(
      plugin.instantiate.customElementName
    ) as InputWidget;
    element.schema = schema;
    element.metadata = this.metadata;
    element.addEventListener("bb-input-change", this.#onChange, { signal });
    return element;
  }

  #onChange = (event: InputChangeEvent) => {
    // Set the #value shadow to avoid redundantly setting the value back on the
    // widget element via the #widget task, since we can assume it already knows
    // about the value it just dispatched an event for.
    this.#value = event.value;
    this.dispatchEvent(new Event("input"));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-delegating-input": DelegatingInput;
  }
}

function chooseBestPlugin(schema: JSONSchema4, environment: Environment) {
  const behavior = schema.behavior?.at(0);
  // TODO(aomarks) Performance of this search could be improved by
  // partitioning by the top-level "type" field. But note we have to account
  // for schema compositions like `{ anyOf: { ... } }`, so it's not so
  // simple.
  for (const plugin of environment.plugins.input) {
    const pluginSchema = plugin.match.schema as Schema;
    if (
      behavior &&
      pluginSchema.behavior &&
      pluginSchema.behavior.includes(behavior)
    ) {
      return plugin;
    }
    // TODO If there are ties, a good starting heuristic could be to prefer
    // the widget with the most narrowly defined schema, and a proxy for
    // that could simply be JSON.stringify(match.schema).length.
    if (analyzeIsJsonSubSchema(schema, plugin.match.schema).isSubSchema) {
      return plugin;
    }
  }
}
