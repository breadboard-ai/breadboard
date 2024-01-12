/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnyRunResult } from "@google-labs/breadboard/harness";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Output } from "./output.js";

@customElement("bb-output-list")
export class OutputList extends LitElement {
  @property({ reflect: false })
  messages: AnyRunResult[] | null = null;

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

    const outputs: Output[] = [];
    for (let idx = 0; idx < this.messagePosition; idx++) {
      const message = this.messages[idx];
      if (message.type !== "output") {
        continue;
      }

      const output = new Output(message.data.outputs);
      outputs.unshift(output);
    }

    if (!outputs.length) {
      return html`There are no outputs yet.`;
    }

    return html`${outputs}`;
  }
}
