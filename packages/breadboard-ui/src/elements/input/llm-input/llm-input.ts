/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  AllowedLLMContentTypes,
  LLMContent,
  LLMFunctionCall,
  LLMFunctionResponse,
  LLMInlineData,
  LLMPart,
  LLMText,
} from "../../../types/types.js";
import { Schema } from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { asBase64 } from "../../../utils/as-base-64.js";
import { until } from "lit/directives/until.js";
import { cache } from "lit/directives/cache.js";
import { guard } from "lit/directives/guard.js";
import type { AudioInput } from "../audio/audio.js";
import type { DrawableInput } from "../drawable/drawable.js";
import type { WebcamInput } from "../webcam/webcam.js";

function isText(part: LLMPart): part is LLMText {
  return "text" in part;
}

function isFunctionCall(part: LLMPart): part is LLMFunctionCall {
  return "functionCall" in part;
}

function isFunctionResponse(part: LLMPart): part is LLMFunctionResponse {
  return "functionResponse" in part;
}

function isInlineData(part: LLMPart): part is LLMInlineData {
  return "inlineData" in part;
}

const inlineDataTemplate = { inlineData: { data: "", mimeType: "" } };

type MultiModalInput = AudioInput | DrawableInput | WebcamInput;

@customElement("bb-llm-input")
export class LLMInput extends LitElement {
  @property()
  value: LLMContent | null = null;

  @property()
  schema: Schema | null = null;

  @property()
  description: string | null = null;

  @property()
  allow: AllowedLLMContentTypes = {
    audioFile: true,
    audioMicrophone: true,
    videoFile: true,
    videoWebcam: true,
    imageFile: true,
    imageWebcam: true,
    imageDrawable: true,
    textFile: true,
    textInline: true,
  };

  #focusLastPart = false;
  #triggerSelectionFlow = false;
  #lastPartRef: Ref<HTMLSpanElement> = createRef();
  #lastInputRef: Ref<HTMLInputElement> = createRef();
  #containerRef: Ref<HTMLDivElement> = createRef();

  #partDataURLs = new Map<number, string>();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    header {
      display: flex;
      align-items: center;
      height: var(--bb-grid-size-5);
      margin-bottom: var(--bb-grid-size-2);
    }

    #description {
      display: inline-block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #controls {
      flex: 1 0 auto;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-left: var(--bb-grid-size-4);
    }

    #controls > span {
      margin-right: var(--bb-grid-size-2);
    }

    #controls #add-text,
    #controls #add-image-webcam,
    #controls #add-image-drawable,
    #controls #add-video-webcam,
    #controls #add-audio-microphone,
    #controls #add-file {
      width: 20px;
      height: 20px;
      opacity: 0.5;
      margin-right: var(--bb-grid-size-2);
      border: none;
      border-radius: 0;
      font-size: 0;
      cursor: pointer;
    }

    #controls #add-text {
      background: #fff var(--bb-icon-add-text) center center / 20px 20px
        no-repeat;
    }

    #controls #add-image-webcam {
      background: #fff var(--bb-icon-add-image-webcam) center center / 20px 20px
        no-repeat;
    }

    #controls #add-image-drawable {
      background: #fff var(--bb-icon-add-drawable) center center / 20px 20px
        no-repeat;
    }

    #controls #add-video-webcam {
      background: #fff var(--bb-icon-add-video) center center / 20px 20px
        no-repeat;
    }

    #controls #add-audio-microphone {
      background: #fff var(--bb-icon-add-audio) center center / 20px 20px
        no-repeat;
    }

    #controls #add-file {
      background: #fff var(--bb-icon-add-file) center center / 20px 20px
        no-repeat;
    }

    #controls #add-text:hover,
    #controls #add-image-webcam:hover,
    #controls #add-image-drawable:hover,
    #controls #add-video-webcam:hover,
    #controls #add-audio-microphone:hover,
    #controls #add-file:hover,
    #controls #add-text:focus,
    #controls #add-image-webcam:focus,
    #controls #add-image-drawable:focus,
    #controls #add-video-webcam:focus,
    #controls #add-audio-microphone:focus,
    #controls #add-file:focus {
      opacity: 1;
    }

    #container {
      resize: vertical;
      overflow: auto;
      height: 30vh;
      min-height: var(--bb-grid-size-6);
      border: 2px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
      padding: var(--bb-grid-size-3) 0;
    }

    .content {
      display: grid;
      grid-template-columns: var(--bb-grid-size-12) auto;
      margin-bottom: var(--bb-grid-size-4);
    }

    .prefix {
      border-right: 2px solid var(--bb-output-200);
      display: flex;
      justify-content: center;
      font: normal var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-300);
    }

    .value {
      margin: 0 var(--bb-grid-size-3);
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-900);
    }

    .value img,
    .value video,
    .value audio {
      max-width: 100%;
    }

    .value img,
    .value video {
      outline: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    .value .plain-text {
      white-space: pre;
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);
      color: var(--bb-neutral-600);
    }

    .value bb-webcam-input {
      --bb-border-radius: var(--bb-grid-size);
      --bb-box-shadow: none;
      --bb-outline: var(--bb-neutral-300);
    }

    .value bb-drawable-input {
      --bb-border-radius: var(--bb-grid-size);
      --bb-box-shadow: none;
      --bb-outline: var(--bb-neutral-300);
    }

    #no-parts {
      padding: 0 var(--bb-grid-size-3);
    }

    .confirm {
      background: var(--bb-continue-color) var(--bb-icon-confirm-blue) 8px 4px /
        16px 16px no-repeat;
      color: var(--bb-output-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    this.#partDataURLs.clear();
  }

  #sanitizePastedContent(evt: ClipboardEvent) {
    evt.preventDefault();

    if (!evt.clipboardData) {
      return;
    }

    if (!(evt.currentTarget instanceof HTMLSpanElement)) {
      return;
    }

    const text = document.createTextNode(evt.clipboardData.getData("text"));
    evt.currentTarget.append(text);
  }

  #emitUpdate() {
    this.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  }

  #addTextPart() {
    if (!this.value) {
      this.value = { role: "user", parts: [] };
    }

    this.value.parts.push({ text: "" });
    this.#focusLastPart = true;
    this.requestUpdate();
  }

  #addPart(mimeType: string, triggerSelectionFlow = true) {
    if (!this.value) {
      this.value = { role: "user", parts: [] };
    }

    this.value.parts.push({ inlineData: { data: "", mimeType } });
    this.#focusLastPart = true;
    this.#triggerSelectionFlow = triggerSelectionFlow;
    this.requestUpdate();
  }

  protected updated(): void {
    const focusLastPart = this.#focusLastPart;
    const triggerSelectionFlow = this.#triggerSelectionFlow;
    this.#focusLastPart = false;
    this.#triggerSelectionFlow = false;

    if (focusLastPart && this.#lastPartRef.value) {
      this.#lastPartRef.value.focus();
    }

    if (triggerSelectionFlow) {
      requestAnimationFrame(() => {
        if (!this.#lastInputRef.value) {
          return;
        }

        this.#lastInputRef.value.click();
      });
    }
  }

  async processAllOpenParts() {
    if (!this.value) {
      return;
    }

    return Promise.all([
      this.value.parts.map((part, idx) => {
        if (!isInlineData(part)) {
          return;
        }

        switch (part.inlineData.mimeType) {
          case "audio-microphone":
          case "image-webcam":
          case "image-drawable": {
            return this.#processInputPart(idx);
          }
        }
      }),
    ]);
  }

  async #processFilePart(evt: InputEvent, partIdx: number) {
    if (!(evt.target instanceof HTMLInputElement)) {
      return;
    }

    const { files } = evt.target;
    if (!files || files.length === 0) {
      return;
    }

    if (!this.value) {
      this.value = { role: "user", parts: [] };
    }

    if (!this.value.parts[partIdx]) {
      this.value.parts[partIdx] = structuredClone(inlineDataTemplate);
    }

    let part = this.value.parts[partIdx];
    if (!isInlineData(part)) {
      part = structuredClone(inlineDataTemplate);
    }

    part.inlineData.data = await asBase64(files[0]);
    part.inlineData.mimeType = files[0].type;
    this.#emitUpdate();
    this.requestUpdate();
  }

  async #processInputPart(partIdx: number) {
    if (!this.value) {
      this.value = { role: "user", parts: [] };
    }

    if (!this.value.parts[partIdx]) {
      this.value.parts[partIdx] = structuredClone(inlineDataTemplate);
    }

    let part = this.value.parts[partIdx];
    if (!isInlineData(part)) {
      part = structuredClone(inlineDataTemplate);
    }

    switch (part.inlineData.mimeType) {
      case "audio-microphone":
      case "image-webcam":
      case "image-drawable": {
        const inputEl =
          this.#containerRef.value?.querySelector<MultiModalInput>(
            `#part-${partIdx}`
          );
        if (!inputEl) {
          break;
        }

        const content = inputEl.value as LLMContent;
        if (!content.parts.length || !isInlineData(content.parts[0])) {
          break;
        }

        const contentPart = content.parts[0];
        part.inlineData = contentPart.inlineData;
        break;
      }
    }

    this.#emitUpdate();
    this.requestUpdate();
  }

  #createAcceptList() {
    const accept = [];
    if (this.allow.audioFile) {
      accept.push("audio/*");
    }

    if (this.allow.videoFile) {
      accept.push("video/*");
    }

    if (this.allow.imageFile) {
      accept.push("image/*");
    }

    if (this.allow.textFile) {
      accept.push("text/plain");
    }

    if (accept.length === 0) {
      console.warn("No file types are allowed - defaulting to text");
      accept.push("text/plain");
    }

    return accept.join(",");
  }

  async #getPartDataAsHTML(
    idx: number,
    part: LLMInlineData,
    isLastPart = false
  ) {
    let url = this.#partDataURLs.get(idx);
    if (!url && part.inlineData.data !== "") {
      const dataURL = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      const response = await fetch(dataURL);
      const data = await response.blob();

      url = URL.createObjectURL(data);
      this.#partDataURLs.set(idx, url);
    }

    switch (part.inlineData.mimeType) {
      case "image/png":
      case "image/jpg":
      case "image/jpeg":
      case "image/heic":
      case "image/heif":
      case "image/webp": {
        return cache(html`<img src="${url}" alt="LLM Image" />`);
      }

      case "audio/wav":
      case "audio/x-m4a":
      case "audio/m4a":
      case "audio/webm":
      case "audio/mp3": {
        return cache(html`<audio src="${url}" controls />`);
      }

      case "video/mp4":
      case "video/quicktime":
      case "video/webm": {
        return cache(html`<video src="${url}" controls />`);
      }

      case "text/plain": {
        // prettier-ignore
        return cache(html`<div class="plain-text">${atob(part.inlineData.data)}</div>`);
      }

      case "file": {
        const accept = this.#createAcceptList();
        return html`<label for="part-${idx}"
          ><input
            ${isLastPart ? ref(this.#lastInputRef) : nothing}
            @input=${(evt: InputEvent) => {
              evt.preventDefault();
              evt.stopImmediatePropagation();

              this.#processFilePart(evt, idx);
            }}
            type="file"
            accept="${accept}"
            id="part-${idx}"
        /></label>`;
      }

      case "audio-microphone": {
        return cache(
          html`<bb-audio-input id="part-${idx}"></bb-audio-input
            ><button
              class="confirm"
              @click=${(evt: InputEvent) => {
                evt.preventDefault();
                evt.stopImmediatePropagation();

                this.#processInputPart(idx);
              }}
            >
              Confirm
            </button>`
        );
      }

      case "image-webcam": {
        return cache(
          html`<bb-webcam-input id="part-${idx}"></bb-webcam-input
            ><button
              class="confirm"
              @click=${(evt: InputEvent) => {
                evt.preventDefault();
                evt.stopImmediatePropagation();

                this.#processInputPart(idx);
              }}
            >
              Confirm
            </button>`
        );
      }

      case "image-drawable": {
        return cache(
          html`<bb-drawable-input id="part-${idx}"></bb-drawable-input
            ><button
              class="confirm"
              @click=${(evt: InputEvent) => {
                evt.preventDefault();
                evt.stopImmediatePropagation();

                this.#processInputPart(idx);
              }}
            >
              Confirm
            </button>`
        );
      }

      case "video-webcam": {
        return html`Video inputs are not yet supported`;
      }

      default: {
        return html`<label for="part-${idx}"
          ><input type="file" id="part-${idx}"
        /></label>`;
      }
    }
  }

  render() {
    const allowFile =
      this.allow.audioFile ||
      this.allow.imageFile ||
      this.allow.videoFile ||
      this.allow.textFile;

    return html` <header>
        <span id="description">${this.description}</span>
        <span id="controls">
          <span>Insert:</span>
          ${this.allow.textInline
            ? html`<button
                title="Add text field"
                id="add-text"
                @click=${this.#addTextPart}
              >
                Text
              </button>`
            : nothing}
          ${this.allow.imageWebcam
            ? html`<button
                title="Add image from webcam"
                id="add-image-webcam"
                @click=${() => this.#addPart("image-webcam")}
              >
                Image (Webcam)
              </button>`
            : nothing}
          ${this.allow.imageDrawable
            ? html`<button
                title="Add image from drawable"
                id="add-image-drawable"
                @click=${() => this.#addPart("image-drawable")}
              >
                Image (Drawable)
              </button>`
            : nothing}
          ${this.allow.audioMicrophone
            ? html`<button
                title="Add audio from microphone"
                id="add-audio-microphone"
                @click=${() => this.#addPart("audio-microphone")}
              >
                Audio
              </button>`
            : nothing}
          ${allowFile
            ? html`<button
                title="Add file"
                id="add-file"
                @click=${() => this.#addPart("file")}
              >
                File
              </button>`
            : nothing}
        </span>
      </header>
      <div id="container" ${ref(this.#containerRef)}>
        ${this.value
          ? map(this.value.parts, (part, idx) => {
              const isLastPart = idx === (this.value?.parts.length || 0) - 1;

              let partClass = "";
              let prefix = "";
              let value: HTMLTemplateResult | symbol = nothing;
              if (isText(part)) {
                partClass = "text";
                prefix = "txt";
                value = html`${part.text}`;
              } else if (isFunctionCall(part)) {
                partClass = "function-call";
                prefix = "fn";
                value = html`${part.functionCall.name}`;
              } else if (isFunctionResponse(part)) {
                partClass = "function-response";
                prefix = "fn";
                value = html`${part.functionResponse.name}
                ${JSON.stringify(part.functionResponse.response, null, 2)}`;
              } else if (isInlineData(part)) {
                partClass = "inline-data";
                prefix = part.inlineData.mimeType
                  .replace(/^[^\\/]+\//, "")
                  // Remove all vowels except the first.
                  .replace(/(?<!^)[aeiou]/gi, "");

                switch (part.inlineData.mimeType) {
                  case "text/plain":
                    prefix = "txt";
                    break;
                  case "file":
                    prefix = "";
                    break;
                  case "image-webcam":
                    prefix = "img";
                    break;
                  case "image-drawable":
                    prefix = "drwbl";
                    break;
                  case "audio-microphone":
                    prefix = "mic";
                    break;
                  case "video-webcam":
                    prefix = "vid";
                    break;
                }

                value = html`${until(
                  this.#getPartDataAsHTML(idx, part, isLastPart),
                  "Loading..."
                )}`;
              }

              return guard(
                [prefix],
                () =>
                  html`<div
                    class=${classMap({ part: true, [partClass]: true })}
                  >
                    <div class="content">
                      <span class="prefix">${prefix}</span>
                      <span
                        class="value"
                        ?contenteditable=${isText(part)}
                        @input=${(evt: Event) => {
                          if (!isText(part)) {
                            return;
                          }

                          if (!(evt.target instanceof HTMLSpanElement)) {
                            return;
                          }

                          part.text = evt.target.textContent || "";
                        }}
                        @paste=${this.#sanitizePastedContent}
                        tabIndex="0"
                        ${isLastPart ? ref(this.#lastPartRef) : nothing}
                        >${value}</span
                      >
                    </div>
                  </div>`
              );
            })
          : html`<div id="no-parts">No parts yet - please add one</div>`}
      </div>`;
  }
}
