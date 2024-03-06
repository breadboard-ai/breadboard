/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeConfiguration, NodeValue } from "@google-labs/breadboard";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Input } from "../input.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

@customElement("bb-input-list")
export class InputList extends LitElement {
  @property({ reflect: false })
  messages: HarnessRunResult[] | null = null;

  @property({ reflect: true })
  messagePosition = 0;

  @property()
  lastUpdate: number = Number.NaN;

  #pendingInput: Ref<Input> = createRef();

  static styles = css`
    :host {
      display: block;
    }
  `;

  #obtainProcessedValuesIfAvailable(
    id: string,
    idx: number,
    messages: HarnessRunResult[]
  ): Record<string, NodeValue> | null {
    for (let i = idx; i < this.messagePosition; i++) {
      const message = messages[i];
      if (message.type === "nodeend" && message.data.node.id === id) {
        return message.data.outputs;
      }
    }

    return null;
  }

  captureNewestInput() {
    if (!this.#pendingInput.value) {
      return;
    }

    this.#pendingInput.value.processInput();
  }

  render() {
    if (!this.messages) {
      return;
    }

    type InputDescription = {
      id: string;
      configuration?: NodeConfiguration;
      remember: boolean;
      secret: boolean;
      processedValues: Record<string, NodeValue> | null;
    };

    // Infer from the messages received which inputs need to be shown to the
    // user.
    const inputs: InputDescription[] = [];
    const message = this.messages[this.messagePosition];
    if (!message || (message.type !== "input" && message.type !== "secret")) {
      return;
    }

    // Any secrets that are not the most recent message don't need to be
    // captured here; they should already have been handled and don't need to
    // be rendered. In fact, if rendered they would immediately fire an event
    // (which won't be captured). We can therefore skip them.
    if (message.type === "secret") {
      for (const id of message.data.keys) {
        inputs.push({
          id,
          configuration: {
            schema: {
              properties: {
                secret: {
                  title: id,
                  description: `Enter ${id}`,
                  type: "string",
                },
              },
            },
          },
          remember: true,
          secret: true,
          processedValues: null,
        });
      }
    } else {
      inputs.push({
        id: message.data.node.id,
        configuration: message.data.inputArguments,
        remember: false,
        secret: false,
        processedValues: null,
      });
    }

    if (!inputs.length) {
      return html`There are no inputs yet.`;
    }

    return html` ${inputs.map(
      ({ id, secret, remember, configuration, processedValues }, idx) => {
        if (!this.messages) {
          return nothing;
        }

        return html`<bb-input
          id="${id}"
          ${idx === 0 ? ref(this.#pendingInput) : void 0}
          .secret=${secret}
          .remember=${remember}
          .configuration=${configuration}
          .processedValues=${processedValues}
        ></bb-input>`;
      }
    )}`;
  }
}
