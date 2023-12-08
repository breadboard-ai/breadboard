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

export type OutputArgs = {
  node: {
    id: string;
    type: string;
    configuration: unknown;
  };
  outputs: {
    schema: Schema;
  } & Record<string, unknown>;
};

export class Output extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          border-top: 1px solid rgb(240, 240, 240);
          padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
        }

        #container {
          display: flex;
        }

        #container::before {
          content: '';
          box-sizing: border-box;
          width: calc(var(--bb-grid-size) * 4);
          height: calc(var(--bb-grid-size) * 4);
          background: #b6d7a8ff;
          border: 1px solid #38761d;
          border-radius: 50%;
          margin-right: calc(var(--bb-grid-size) * 2);
          flex: 0 0 auto;
        }

        pre {
          line-height: 1.5;
          font-size: var(--bb-text-nano);
          margin: 0;
          white-space: pre-line;
          max-height: 20vh;
          overflow: auto;
          scrollbar-gutter: stable;
        }
      </style>
      <div id="container"></div>
    `;
  }

  async display(values: OutputArgs["outputs"]) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const root = this.shadowRoot!;
    const schema = values.schema;
    if (!schema || !schema.properties) {
      root.append(JSON.stringify(values, null, 2) + "\n");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const outputWrapper = root.querySelector("#container")!;
    await Promise.all(
      Object.entries(schema.properties).map(async ([key, property]) => {
        if (property.type === "object") {
          if (property.format === "stream") {
            await this.appendStream(
              property,
              (values[key] as StreamCapabilityType).stream
            );
            return;
          } else {
            const response = document.createElement("pre");
            response.innerHTML = `${property.title}: ${JSON.stringify(
              values[key],
              null,
              2
            )}`;
            outputWrapper.appendChild(response);
            return;
          }
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
