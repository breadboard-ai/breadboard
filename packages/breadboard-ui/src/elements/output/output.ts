/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  tee,
  type OutputValues,
  type StreamCapabilityType,
} from "@google-labs/breadboard";

import { LitElement, html, css, HTMLTemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { until } from "lit/directives/until.js";
import { OutputArgs } from "../../types/types.js";

type ChunkOutputs = OutputValues & { chunk: string };

@customElement("bb-output")
export class Output extends LitElement {
  #jsonTree: Promise<HTMLTemplateResult>;

  static styles = css`
    :host {
      display: block;
      padding: calc(var(--bb-grid-size) * 2) 0;
    }
  `;

  constructor(data: OutputArgs["outputs"]) {
    super();

    this.#jsonTree = this.#convertDataToHtml(data);
  }

  async #convertDataToHtml(
    data: OutputArgs["outputs"]
  ): Promise<HTMLTemplateResult> {
    let json: Record<string, unknown> = {};

    const schema = data.schema;
    if (!schema || !schema.properties) {
      json = data;
    } else {
      // Populate the JSON data with the expanded values.
      await Promise.all(
        Object.entries(schema.properties).map(async ([key, property], idx) => {
          if (property.type === "object" && property.format === "stream") {
            let value = "";
            await tee(data[key] as StreamCapabilityType).pipeTo(
              new WritableStream({
                write(chunk) {
                  // For now, presume that the chunk is an `OutputValues` object
                  // and the relevant item is keyed as `chunk`.
                  const outputs = chunk as ChunkOutputs;
                  console.log("chunk", outputs.chunk);
                  value += outputs.chunk;
                },
              })
            );

            json[key] = value;
            return;
          }

          json[property.title || `Untitled property (${idx})`] = data[key];
          return;
        })
      );
    }

    return html`<bb-json-tree .json=${json} autoExpand="true"></bb-json-tree>`;
  }

  render() {
    return html`${until(this.#jsonTree, html`Processing output...`)}`;
  }
}
