/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema } from "@google-labs/breadboard";

// TODO: Define this more precisely.
type MultipartValue = unknown;
type MultipartData = { value: MultipartValue; html: HTMLElement };

const MULTIPART_INPUT_PREFIX = "multipart-input-";

export const isMultipart = (schema: Schema) => {
  return schema.type == "array" && schema.format == "multipart";
};

const getId = (key: string) => {
  return `${MULTIPART_INPUT_PREFIX}${key}`;
};

export const createMultipartInput = (_: Schema, key: string) => {
  return new MultipartInput(getId(key));
};

export const getMultipartValue = async (form: HTMLFormElement, key: string) => {
  const input = form.querySelector(`#${getId(key)}`) as MultipartInput;
  return await input?.getValue();
};

export class MultipartInput extends HTMLElement {
  constructor(id: string) {
    super();
    this.id = id;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
          :host {
            display: flex;
            flex-direction: column;
            flex: 1;
          }

          * {
            white-space: initial;
          }

          textarea {
            width: var(--bb-input-width, 80%);
          }

          div {
            padding-top: 0.5rem;
          }

          button {
            cursor: pointer;
            background-color: transparent;
            padding-right: 1rem;
            border: none;
          }
      </style>
      <slot></slot>
      <div>
        <button id="add-text">➕ Add text</button>
        <button id="add-image">🖼️ Add image</button>
      </div>`;
    root.querySelector("#add-text")?.addEventListener("click", () => {
      this.append(new MultipartInputText());
    });
    root.querySelector("#add-image")?.addEventListener("click", () => {
      this.append(new MultipartInputImage());
    });
    this.append(new MultipartInputText());
  }

  async getValue() {
    const value: unknown[] = [];
    const html: HTMLElement[] = [];
    await Promise.all(
      Array.from(this.children).map(async (child) => {
        const data = await (child as MultipartInputPart).getData();
        value.push(data.value);
        html.push(data.html);
      })
    );
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
          cursor: pointer;
        }

        button {
          border: none;
          background-color: transparent;
        }

        textarea {
          width: 80%;
        }

        img {
          max-width: 80%;
          height: 6rem;
        }
      </style>
      <button id="delete">🗑️</button>
    `;
    root.querySelector("#delete")?.addEventListener("click", () => {
      this.remove();
    });
  }

  abstract getData(): Promise<MultipartData>;
}

export class MultipartInputImage extends MultipartInputPart {
  #file?: File;

  constructor() {
    super();
    const upload = document.createElement("input") as HTMLInputElement;
    upload.type = "file";
    upload.accept = "image/png, image/jpeg";
    upload.addEventListener("change", () => {
      if (!upload?.files?.length) return;
      const image = document.createElement("img") as HTMLImageElement;
      this.#file = upload.files[0];
      image.src = URL.createObjectURL(this.#file);
      this.shadowRoot?.prepend(image);
    });
    upload.click();
  }

  async getData() {
    if (!this.#file) throw new Error("Improperly initialized part input");
    const reader = new FileReader();

    return new Promise<MultipartData>((resolve) => {
      reader.addEventListener("loadend", async () => {
        const base64url = reader.result as string;
        const html = document.createElement("span");
        const img = document.createElement("img");
        img.src = base64url;
        html.append(img);
        const data = base64url.slice(base64url.indexOf(",") + 1);
        resolve({
          value: {
            inline_data: { mime_type: "image/png", data },
          },
          html,
        });
      });
      this.#file && reader.readAsDataURL(this.#file);
    });
  }
}

export class MultipartInputText extends MultipartInputPart {
  constructor() {
    super();
    const textarea = document.createElement("textarea");
    textarea.placeholder = "text";
    this.shadowRoot?.prepend(textarea);
  }

  async getData() {
    const textarea = this.shadowRoot?.querySelector("textarea");
    if (!textarea) throw new Error("Improperly initialized part input");
    const text = textarea.value;
    const html = document.createElement("div");
    html.textContent = text;
    return { value: { text }, html };
  }
}
