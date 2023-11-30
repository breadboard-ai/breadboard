/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  OutputValues,
  StreamCapabilityType,
  Schema,
} from "@google-labs/breadboard";

export type OutputArgs = Record<string, unknown> & {
  schema: Schema;
};

export class Output extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          padding-bottom: calc(var(--bb-grid-size) * 3);
        }

        details {
          border-radius: calc(var(--bb-grid-size) * 4);
          background: rgb(240, 240, 240);
          list-style: none;
        }

        #output-wrapper {
          border-radius: 0 0 calc(var(--bb-grid-size) * 4) calc(var(--bb-grid-size) * 4);
          background: rgb(240, 240, 240);
          padding-bottom: calc(var(--bb-grid-size) * 8);
        }

        summary {
          list-style: none;
          font-size: var(--bb-text-small);
          font-weight: 500;
          padding: calc(var(--bb-grid-size) * 3) calc(var(--grid-size) * 8);
        }

        summary::-webkit-details-marker {
          display: none;
        }

        pre {
          line-height: 1.5;
          overflow-x: auto;
          padding: calc(var(--bb-grid-size) * 3) calc(var(--grid-size) * 8);
          background: rgb(253, 253, 255);
          font-size: var(--bb-text-medium);
          margin: 0;
          white-space: pre-line;
        }

      </style>
      <details open>
        <summary>Output</summary>
        <div id="output-wrapper"></div>
      </details>
    `;
  }

  async display(values: OutputArgs) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const root = this.shadowRoot!;
    const schema = values.schema;
    if (!schema || !schema.properties) {
      root.append(JSON.stringify(values, null, 2) + "\n");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputWrapper = root.querySelector("#output-wrapper")!;
    await Promise.all(
      Object.entries(schema.properties).map(async ([key, property]) => {
        if (property.type === "object" && property.format === "stream") {
          await this.appendStream(
            property,
            (values[key] as StreamCapabilityType).stream
          );
          return;
        }
        const response = document.createElement("pre");
        response.innerHTML = `${property.title}: ${values[key]}`;
        outputWrapper.appendChild(response);
      })
    );
  }

  async appendStream(property: Schema, stream: ReadableStream) {
    type ChunkOutputs = OutputValues & { chunk: string };
    const root = this.shadowRoot;
    if (!root) return;
    root.append(`${property.title}: `);
    const pre = document.createElement("pre");
    root.append(pre);
    await stream.pipeTo(
      new WritableStream({
        write(chunk) {
          // For now, presume that the chunk is an `OutputValues` object
          // and the relevant item is keyed as `chunk`.
          const outputs = chunk as ChunkOutputs;
          pre.append(outputs.chunk);
        },
      })
    );
  }
}
