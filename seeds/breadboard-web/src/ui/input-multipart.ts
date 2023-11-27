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
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            column-gap: calc(var(--bb-grid-size) * 2);
            flex-direction: column;
            flex: 1;
            position: relative;
          }

          * {
            white-space: initial;
          }

          textarea {
            width: var(--bb-input-width, 80%);
          }

          #controls {
            position: absolute;
            top: -32px;
            right: 0;
            height: 24px;
          }

          button {
            cursor: pointer;
            background-color: transparent;
            margin-left: calc(var(--bb-grid-size) * 2);
            padding-left: calc(var(--bb-grid-size) * 5);
            border: none;
            position: relative;
            z-index: 1;
            height: 25px;
            transition: opacity var(--bb-easing-duration-out) var(--bb-easing);
            opacity: 0.5;
            font-size: 0;
          }
  
          button:hover {
            transition: opacity var(--bb-easing-duration-in) var(--bb-easing);
            opacity: 1;
          }

          button::before {
            content: '';
            width: 24px;
            height: 24px;
            background: red;
            position: absolute;
            left: calc(var(--bb-grid-size) * 1);
            top: 0;
            pointer-events: none;
          }

          #add-text::before {
            background: var(--bb-icon-add-note) center center no-repeat;
          }

          #add-image::before {
            background: var(--bb-icon-add-photo) center center no-repeat;
          }

          @media (min-width: 910px) {
            button {
              font-size: var(--bb-text-medium);
              padding-left: calc(var(--bb-grid-size) * 8);
            }
          }

          ::slotted(.full-width) {
            grid-column: 1 / 5;
          }

      </style>
      <div id="controls">
        <button id="add-text">Add text</button>
        <button id="add-image">Add image</button>
      </div>
      <slot name="text"></slot>
      <slot name="image"></slot>`;

    const appendText = () => {
      const text = new MultipartInputText();
      text.classList.add("full-width");
      text.slot = "text";
      this.append(text);
    };

    root.querySelector("#add-text")?.addEventListener("click", appendText);

    root.querySelector("#add-image")?.addEventListener("click", () => {
      const image = new MultipartInputImage();
      image.classList.add("reserved");
      image.slot = "image";
      this.append(image);
    });

    appendText();
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
          width: 100%;
          position: relative;
          margin-bottom: calc(var(--grid-size) * 2);
          min-height: calc(var(--grid-size) * 32);
        }

        :host(.reserved) {
          border-radius: calc(var(--grid-size) * 8);
          background: rgb(255, 255, 255);
          border: 1px solid rgb(209, 209, 209);
        }

        :host(.pending)::before {
          content: '';
          width: calc(100% - var(--grid-size) * 12);
          height: calc(var(--grid-size) * 31);
          margin: calc(var(--grid-size) * 2);
          border-radius: calc(var(--grid-size) * 6);
          background: rgb(240, 240, 240);
          box-sizing: border-box;
        }

        * {
          box-sizing: border-box;
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

        .multiline {
          grid-column: 1 / 5;
          flex: 1;
          width: 100%;
          overflow: hidden;
          border-radius: calc(var(--grid-size) * 10);
          border: 1px solid rgb(209, 209, 209);
          height: 100%;
        }

        textarea {
          resize: none;
          line-height: 1.4;
          border: none;
          width: 100%;
          height: 100%;
          border-radius: calc(var(--grid-size) * 10);
          background: rgb(255, 255, 255);
          min-height: calc(var(--grid-size) * 12);
          padding: calc(var(--grid-size) * 4) calc(var(--grid-size) * 10) calc(var(--grid-size) * 4) calc(var(--grid-size) * 8);
        }

        img {
          width: calc(100% - 32px);
          height: calc(var(--grid-size) * 36);
          padding: calc(var(--grid-size) * 2);
          border-radius: calc(var(--grid-size) * 8);
          object-fit: cover;
          aspect-ratio: auto;
        }

        #delete {
          position: absolute;
          top: 50%;
          right: calc(var(--grid-size) * 2);
          background: rgb(255, 255, 255);
          border-radius: 50%;
          background: var(--bb-icon-delete) center center no-repeat;
          font-size: 0;
          translate: 0 -50%;
        }
      </style>
      <button id="delete" title="Delete">Delete</button>
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
    this.classList.add("pending");

    const upload = document.createElement("input") as HTMLInputElement;
    upload.type = "file";
    upload.accept = "image/png, image/jpeg";
    upload.addEventListener("change", () => {
      if (!upload?.files?.length) return;
      const image = document.createElement("img") as HTMLImageElement;
      this.#file = upload.files[0];
      image.src = URL.createObjectURL(this.#file);
      this.shadowRoot?.prepend(image);
      this.classList.remove("pending");
    });

    upload.addEventListener("cancel", () => {
      this.remove();
    });

    upload.click();
  }

  async getData() {
    if (!this.#file) throw new Error("Improperly initialized part input");
    const reader = new FileReader();

    return new Promise<MultipartData>((resolve) => {
      reader.addEventListener("loadend", async () => {
        const base64url = reader.result as string;
        const html = document.createElement("img");
        html.src = base64url;
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
    const container = document.createElement("div");
    container.classList.add("multiline");

    const textarea = container.appendChild(document.createElement("textarea"));
    textarea.placeholder = "Enter your text";
    textarea.required = true;
    this.shadowRoot?.prepend(container);
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
