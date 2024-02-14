/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "@google-labs/breadboard/harness";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Output } from "../output.js";
import { BoardError } from "../error.js";
import { ErrorObject } from "@google-labs/breadboard";

@customElement("bb-output-list")
export class OutputList extends LitElement {
  @property({ reflect: false })
  messages: HarnessRunResult[] | null = null;

  @property({ reflect: true })
  messagePosition = 0;

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    if (!this.messages) {
      return;
    }

    const outputs: Array<Output | BoardError> = [];
    for (let idx = 0; idx <= this.messagePosition; idx++) {
      const message = this.messages[idx];
      if (!message || (message.type !== "output" && message.type !== "error")) {
        continue;
      }

      let output: Output | BoardError;
      if (message.type === "output") {
        output = new Output(message.data.outputs);
      } else {
        output = new BoardError();
        if (typeof message.data.error === "string") {
          output.message = message.data.error.toString();
        } else {
          let messageOutput = "";
          let error = message.data.error;
          while (typeof error === "object") {
            if (error && "message" in error) {
              messageOutput += `${error.message}\n`;
            }

            error = error.error as ErrorObject;
          }

          output.message = messageOutput;
        }
      }
      outputs.unshift(output);
    }

    if (!outputs.length) {
      return html`There are no outputs yet.`;
    }

    return html`${outputs}`;
  }
}
