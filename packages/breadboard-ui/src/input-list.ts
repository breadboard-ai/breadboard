/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeConfiguration, NodeValue } from "@google-labs/breadboard";
import { AnyRunResult } from "@google-labs/breadboard/harness";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("bb-input-list")
export class InputList extends LitElement {
  @property({ reflect: false })
  messages: AnyRunResult[] | null = null;

  @property({ reflect: true })
  messagePosition = 0;

  @property()
  lastUpdate: number = Number.NaN;

  static styles = css`
    :host {
      display: block;
    }
  `;

  #obtainProcessedValuesIfAvailable(
    idx: number,
    id: string,
    messages: AnyRunResult[]
  ): Record<string, NodeValue> | null {
    for (let i = idx; i < this.messagePosition; i++) {
      const message = messages[i];
      if (message.type === "nodeend" && message.data.node.id === id) {
        return message.data.outputs;
      }
    }

    return null;
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
    };

    // Infer from the messages received which inputs need to be shown to the
    // user.
    const inputs: InputDescription[] = [];
    for (let idx = this.messagePosition; idx >= 0; idx--) {
      const message = this.messages[idx];
      if (!message || (message.type !== "input" && message.type !== "secret")) {
        continue;
      }

      // Any secrets that are not the most recent message don't need to be
      // captured here; they should already have been handled and don't need to
      // be rendered. In fact, if rendered they would immediately fire an event
      // (which won't be captured). We can therefore skip them.
      const isMostRecentMessage = idx === this.messages.length - 1;
      if (message.type === "secret" && isMostRecentMessage) {
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
          });
        }
        continue;
      }

      // Capture all inputs.
      if (message.type === "input") {
        inputs.push({
          id: message.data.node.id,
          configuration: message.data.inputArguments,
          remember: false,
          secret: false,
        });
      }
    }

    if (!inputs.length) {
      return html`There are no inputs yet.`;
    }

    return html`${inputs.map(({ id, secret, remember, configuration }, idx) => {
      if (!this.messages) {
        return nothing;
      }

      const processedValues = this.#obtainProcessedValuesIfAvailable(
        idx,
        id,
        this.messages
      );
      return html`<bb-input
        id="${id}"
        .secret=${secret}
        .remember=${remember}
        .configuration=${configuration}
        .processedValues=${processedValues}
      ></bb-input>`;
    })}`;
  }
}
