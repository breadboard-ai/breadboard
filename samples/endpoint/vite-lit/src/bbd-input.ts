/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LLMContent, RunInputEvent, Schema } from "./types";
import {
  isLLMContentArraySchema,
  isLLMContentSchema,
  isStringSchema,
} from "./common";

@customElement("bbd-input")
export class Input extends LitElement {
  @property()
  data: RunInputEvent[1] | null = null;

  @property()
  next: string | null = null;

  #renderPorts(schema: Schema) {
    const ports = Object.entries(schema.properties || {}).map(
      ([name, type]) => {
        const {
          title = name,
          placeholder,
          typeDescription,
        } = this.#readTypeInfo(type);
        return html`<div>
          <label
            >${title}:
            <input
              type="text"
              name=${name}
              placeholder=${placeholder}
              required
            />
            <span>${typeDescription}</span>
          </label>
          <div>
            <input type="submit" value="Continue" />
          </div>
        </div>`;
      }
    );
    return ports;
  }

  #readTypeInfo(type: Schema) {
    const typeDescription = isLLMContentArraySchema(type)
      ? "Conversation Context"
      : isLLMContentSchema(type)
        ? "LLM Content"
        : isStringSchema(type)
          ? "Text"
          : "Other";
    return {
      title: type.title,
      placeholder: type.description || type.title || "",
      typeDescription,
    };
  }

  #disableInputs(form: HTMLFormElement) {
    for (const input of Array.from(form.elements) as HTMLInputElement[]) {
      if (input.type === "submit") {
        input.remove();
      } else {
        input.disabled = true;
      }
    }
  }

  #onInput(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = this.next;
    console.log("next", next);
    const inputs: Record<string, string | LLMContent | LLMContent[]> = {};
    for (const [key, value] of data) {
      // Find the corresponding schema in this.data.inputArguments.schema
      // and convert the value to the correct type.
      const schema = this.data!.inputArguments.schema?.properties?.[key];
      if (!schema) {
        console.error(`No schema found for key: ${key}`);
        continue;
      }
      let converted: string | LLMContent | LLMContent[] = value as string;
      if (isLLMContentSchema(schema)) {
        converted = { parts: [{ text: converted }], role: "user" };
      } else if (isLLMContentArraySchema(schema)) {
        converted = [{ parts: [{ text: converted }], role: "user" }];
      }
      inputs[key] = converted;
    }
    this.#disableInputs(form);
    this.dispatchEvent(
      new CustomEvent("bbdinput", {
        detail: {
          inputs,
          next,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.data) {
      return nothing;
    }
    const { id } = this.data.node;
    return html`<h4>Input</h4>
      <div id="id">Node ID: ${id}</div>
      <form
        @submit=${(evt: Event) => {
          evt.preventDefault();
          this.#onInput(evt.target as HTMLFormElement);
        }}
      >
        ${this.#renderPorts(this.data.inputArguments.schema)}
      </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-input": Input;
  }
}
