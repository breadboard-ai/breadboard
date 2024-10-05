/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LLMContent, RunOutputEvent, Schema } from "./types";
import {
  describeType,
  isLLMContentArraySchema,
  isLLMContentSchema,
} from "./common";

@customElement("bbd-output")
export class Output extends LitElement {
  @property()
  data: RunOutputEvent[1] | null = null;

  render() {
    if (!this.data) {
      return nothing;
    }
    const { node, outputs } = this.data;
    const { id } = node;
    return html`<div>
      <div id="id">Node ID: ${id}</div>
      <div id="output">
        ${this.#renderPorts(outputs, node.configuration?.schema)}</div>
      </div>
    </div>`;
  }

  #renderValue(value: unknown, type?: Schema) {
    if (value === null) {
      return "null";
    }
    if (value === undefined) {
      return "undefined";
    }
    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      typeof value === "number"
    ) {
      return value;
    }
    if (type) {
      if (isLLMContentArraySchema(type)) {
        const context = value as LLMContent[];
        const part = context.at(-1)?.parts[0];
        if (part && "text" in part) {
          return part.text;
        }
      } else if (isLLMContentSchema(type)) {
        const context = value as LLMContent;
        const part = context.parts[0];
        if (part && "text" in part) {
          return part.text;
        }
      }
    }
    return html`<bbd-json-tree .json=${value}></bbd-json-tree>`;
  }

  #renderPorts(outputs: Record<string, unknown>, schema?: Schema) {
    return Object.entries(outputs).map(([name, value]) => {
      const type = schema?.properties?.[name];
      const typeDescription = describeType(type);
      const { title } = type || { title: name };
      return html`<div>
        <label>${title}:</label>
        <div id="valueAndType">
          <div id="value">${this.#renderValue(value, type)}</div>
          <div id="type">${typeDescription}</div>
        </div>
      </div>`;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-output": Output;
  }
}
