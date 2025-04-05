/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, SignalWatcher } from "@lit-labs/signals";
import { AsyncComputed } from "signal-utils/async-computed";
import { LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Organizer } from "../../state";
import { AssetPath, NodeValue } from "@breadboard-ai/types";
import { isLLMContent, isLLMContentArray, ok } from "@google-labs/breadboard";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { UserInputConfiguration } from "../../types/types";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/behaviors";
import { UserInput } from "../input/user-input";
import { InputEnterEvent } from "../../events/events";

@customElement("bb-edit-connector")
export class EditConnector extends SignalWatcher(LitElement) {
  @property()
  accessor state: Organizer | null = null;

  @property()
  accessor path: AssetPath | null = null;

  #userInputRef: Ref<UserInput> = createRef();

  get value(): Record<string, unknown> {
    return this.#userInputRef.value?.processData(false) || {};
  }

  readonly config = new AsyncComputed(async (signal) => {
    if (!this.state || !this.path) return [];
    const connectorView = await this.state.getConnectorView(this.path);
    signal.throwIfAborted();

    if (!ok(connectorView)) throw new Error(connectorView.$error);

    const props = connectorView.schema.properties;
    if (!props) {
      return [];
    }

    const requiredFields = connectorView.schema.required ?? [];

    const values = connectorView.values as Record<string, unknown>;

    const result: UserInputConfiguration[] = Object.entries(props).reduce(
      (prev, [name, schema]) => {
        let value = (values ? values[name] : undefined) as NodeValue;
        if (schema.type === "object") {
          if (isLLMContentBehavior(schema)) {
            if (!isLLMContent(value)) {
              value = undefined;
            }
          } else {
            value = JSON.stringify(value, null, 2);
          }
        }

        if (schema.type === "array") {
          if (isLLMContentArrayBehavior(schema)) {
            if (!isLLMContentArray(value)) {
              value = undefined;
            }
          } else {
            value = JSON.stringify(value, null, 2);
          }
        }

        if (schema.type === "string" && typeof value === "object") {
          value = undefined;
        }

        prev.push({
          name,
          title: schema.title ?? name,
          secret: false,
          schema,
          configured: false,
          required: requiredFields.includes(name),
          value,
        });

        return prev;
      },
      [] as UserInputConfiguration[]
    );
    return result;
  });

  render() {
    if (!this.state || !this.path) return nothing;

    return html`<bb-user-input
      ${ref(this.#userInputRef)}
      .inputs=${this.config.value || []}
      .llmShowInlineControlsToggle=${false}
      .llmInputShowPartControls=${false}
      @keydown=${(evt: KeyboardEvent) => {
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

        if (evt.key === "Enter" && isCtrlCommand) {
          this.dispatchEvent(
            new InputEnterEvent("connector", this.value, false)
          );
        }
      }}
    ></bb-user-input>`;
  }
}
