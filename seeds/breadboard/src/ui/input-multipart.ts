/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "../types.js";

// TODO: Define this more precisely.
type MultipartValue = unknown;
type MultipartData = { value: MultipartValue; html: HTMLElement };

const MULTIPART_INPUT_PREFIX = "multipart-input-";
const DELETE_EMOJI = "\\1f5d1";

export const isMultipart = (schema: Schema) => {
  return schema.type == "array" && schema.format == "multipart";
};

const getId = (key: string) => {
  return `${MULTIPART_INPUT_PREFIX}${key}`;
};

export const createMultipartInput = (schema: Schema, key: string) => {
  return new MultipartInput(getId(key), schema);
};

export const getMultipartValue = (form: HTMLFormElement, key: string) => {
  const input = form.querySelector(`#${getId(key)}`) as MultipartInput;
  return input?.value;
};

export class MultipartInput extends HTMLElement {
  constructor(id: string, schema: Schema) {
    super();
    this.id = id;
    const placeholder = schema.description || "";
    const defaultValue = schema.default ?? "";
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
          :host {
            display: flex;
            flex-direction: column;
            flex: 1;
          }
          textarea {
            width: var(--bb-input-width, 80%);
          }
      </style>
      <slot></slot>`;
    this.append(new MultipartInputImage());
    this.append(new MultipartInputText());
  }

  get value() {
    const value: unknown[] = [];
    const html: HTMLElement[] = [];
    Array.from(this.children).forEach((child) => {
      const data = (child as MultipartInputPart).getData();
      value.push(data.value);
      html.push(data.html);
    });
    return { value, html };
  }
}

/**
 * Base class for multipart input.
 */
abstract class MultipartInputPart extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: flex;
        }

        #delete {
          width: 2rem;
          height: 2rem;
        }

        #delete:after {
          content: '${DELETE_EMOJI}';
        }
      </style>
      <div id="delete"></div>
    `;
  }

  abstract getData(): MultipartData;
}

export class MultipartInputImage extends MultipartInputPart {
  constructor() {
    super();
    const textarea = document.createElement("textarea");
    textarea.placeholder = "image";
    this.shadowRoot?.prepend(textarea);
  }

  getData() {
    const textarea = this.shadowRoot?.querySelector("textarea");
    if (!textarea) throw new Error("Improperly initialized part input");
    const data = textarea.value;
    const html = document.createElement("img");
    html.src = `data:image/png;base64,${data}`;
    return {
      value: {
        inline_data: { mime_type: "image/png", data },
      },
      html,
    };
  }
}

export class MultipartInputText extends MultipartInputPart {
  constructor() {
    super();
    const textarea = document.createElement("textarea");
    textarea.placeholder = "text";
    this.shadowRoot?.prepend(textarea);
  }

  getData() {
    const textarea = this.shadowRoot?.querySelector("textarea");
    if (!textarea) throw new Error("Improperly initialized part input");
    const text = textarea.value;
    const html = document.createElement("div");
    html.textContent = text;
    return { value: { text }, html };
  }
}
