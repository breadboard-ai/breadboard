/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LLMContent, RunInputEvent, Schema } from "./types";
import {
  describeType,
  isLLMContentArraySchema,
  isLLMContentSchema,
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
            ><span id="title">${title}:</span>
            <span id="data">
              <textarea
                type="text"
                name=${name}
                placeholder=${placeholder}
                required
              ></textarea>
              <span id="type">${typeDescription}</span>
            </span>
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
    const typeDescription = describeType(type);
    return {
      title: type.title,
      placeholder: type.description || type.title || "",
      typeDescription,
    };
  }

  #disableInputs(form: HTMLFormElement) {
    for (const element of Array.from(form.elements)) {
      if (element instanceof HTMLInputElement && element.type === "submit") {
        element.remove();
      } else if (element instanceof HTMLTextAreaElement) {
        element.disabled = true;
      }
    }
  }

  #onInput(form: HTMLFormElement) {
    const data = new FormData(form);
    const next = this.next;
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
    return html` <div id="id">Node ID: <b>${id}</b></div>
      <form
        @submit=${(evt: Event) => {
          evt.preventDefault();
          this.#onInput(evt.target as HTMLFormElement);
        }}
      >
        ${this.#renderPorts(this.data.inputArguments.schema)}
      </form>`;
  }

  static styles = css`
    :host {
      display: block;
      padding-bottom: 1.5rem;
    }

    * {
      box-sizing: border-box;
    }

    textarea {
      resize: none;
      field-sizing: content;
      margin: 0;
      padding: 0.5rem;
      border: none;
      width: 100%;
      outline: none;
      border: 1px solid #ccc;
      flex: 1;
    }

    label {
      display: block;
    }

    div#id {
      padding-bottom: 0.5rem;
    }

    span#title {
      display: block;
      padding-bottom: 0.5rem;
    }

    span#data {
      display: flex;
    }

    span#type {
      display: block;
      padding: 0.5rem;
      width: 200px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "bbd-input": Input;
  }
}
