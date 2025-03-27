/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, SignalWatcher } from "@lit-labs/signals";
import { LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Organizer } from "../../state";
import { AssetPath, LLMContent } from "@breadboard-ai/types";
import { ok, Schema } from "@google-labs/breadboard";
import { until } from "lit/directives/until.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { InputEnterEvent } from "../../events/events";

type InputRef =
  | {
      ref: Ref<Element>;
      schema: Schema;
    }
  | {
      value: unknown;
    };

@customElement("bb-edit-connector")
export class EditConnector extends SignalWatcher(LitElement) {
  @property()
  accessor state: Organizer | null = null;

  @property()
  accessor path: AssetPath | null = null;

  #refs: Map<string, InputRef> = new Map();

  get value(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    this.#refs.forEach((ref, key) => {
      if ("ref" in ref) {
        const value = (ref.ref.value as HTMLInputElement)?.value;
        if (!value) return;

        const isLLMContentArray =
          ref.schema.type === "array" &&
          !Array.isArray(ref.schema.items) &&
          ref.schema.items?.behavior?.includes("llm-content");

        if (isLLMContentArray) {
          result[key] = [value];
        } else {
          result[key] = value;
        }
      } else {
        result[key] = ref.value;
      }
    });
    return result;
  }

  #createLLMInput(value: LLMContent, name: string, schema: Schema) {
    const elementRef = createRef();
    this.#refs.set(name, { ref: elementRef, schema });
    return html`<bb-llm-input
      ${ref(elementRef)}
      @keydown=${(evt: KeyboardEvent) => {
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

        if (evt.key === "Enter" && isCtrlCommand) {
          this.dispatchEvent(new InputEnterEvent(name, this.value, false));
        }
      }}
      .value=${value}
      .clamped=${false}
      .description=${null}
      .showInlineControlsToggle=${true}
      .showInlineControls=${false}
      .showPartControls=${true}
      .autofocus=${true}
    ></bb-llm-input>`;
  }

  render() {
    if (!this.state || !this.path) return nothing;

    const view = this.state
      .getConnectorView(this.path)
      .then((connectorView) => {
        if (!ok(connectorView)) {
          return html`Error loading ${connectorView.$error}`;
        }

        const props = connectorView.schema.properties;
        if (!props) {
          return html`No properties in schema`;
        }

        const values = connectorView.values as Record<string, unknown>;

        return Object.entries(props).map(([name, schema]) => {
          // TODO: Display title & description

          const isLLMContent =
            schema.type === "object" &&
            schema.behavior?.includes("llm-content");
          const isLLMContentArray =
            schema.type === "array" &&
            !Array.isArray(schema.items) &&
            schema.items?.behavior?.includes("llm-content");

          if (isLLMContent) {
            const value = values[name] as LLMContent;
            if (!value) return nothing;
            // TODO: Display title & description
            return this.#createLLMInput(value, name, schema);
          } else if (isLLMContentArray) {
            const value = (
              connectorView.values as Record<string, LLMContent[]>
            )[name]?.at(-1);
            if (!value) return nothing;
            // TODO: Display title & description
            return this.#createLLMInput(value, name, schema);
          } else {
            // TODO: Support other types.

            this.#refs.set(name, { value: values[name] });
            return nothing;
          }
        });
      });

    return html`${until(view)}`;
  }
}
