/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "../types.js";

const MULTIPART_INPUT_PREFIX = "multipart-input-";

export const isMultipart = (schema: Schema) => {
  return schema.type == "array" && schema.format == "multipart";
};

const getId = (key: string) => {
  return `${MULTIPART_INPUT_PREFIX}${key}`;
};

export const createMultipartInput = (schema: Schema, key: string) => {
  return new MultipartInput(
    getId(key),
    schema.description || "",
    schema.default ?? ""
  );
};

export const getMultipartValue = (form: HTMLFormElement, key: string) => {
  const input = form.querySelector(`#${getId(key)}`) as MultipartInput;
  const value = input?.value || "";
  return {
    html: value,
    value,
  };
};

export class MultipartInput extends HTMLElement {
  constructor(id: string, placeholder: string, defaultValue: string) {
    super();
    this.id = id;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
          :host {
            display: block;
            flex: 1
          }
          textarea {
            width: var(--bb-input-width, 80%);
          }
      </style>
      <textarea placeholder="${placeholder}">${defaultValue}</textarea>`;
  }

  get value() {
    return this.shadowRoot?.querySelector("textarea")?.value;
  }
}
