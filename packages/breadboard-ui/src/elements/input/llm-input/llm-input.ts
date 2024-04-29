/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
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

@customElement("bb-llm-input")
export class LLMInput extends LitElement {
  @property()
  value: LLMContent | null = null;

  @property()
  schema: Schema | null = null;

  #focusLastPart = false;
  #triggerSelectionFlow = false;
  #lastPartRef: Ref<HTMLSpanElement> = createRef();
  #lastInputRef: Ref<HTMLInputElement> = createRef();

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
      flex: 1;
      display: inline-block;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #controls {
      width: 200px;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      padding-left: var(--bb-grid-size-4);
    }

    #controls > span {
      margin-right: var(--bb-grid-size-2);
    }

    #controls #add-text,
    #controls #add-image-file,
    #controls #add-video-file,
    #controls #add-audio-file,
    #controls #add-text-file {
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

    #controls #add-image-file {
      background: #fff var(--bb-icon-add-image) center center / 20px 20px
        no-repeat;
    }

    #controls #add-video-file {
      background: #fff var(--bb-icon-add-video) center center / 20px 20px
        no-repeat;
    }

    #controls #add-audio-file {
      background: #fff var(--bb-icon-add-audio) center center / 20px 20px
        no-repeat;
    }

    #controls #add-text-file {
      background: #fff var(--bb-icon-add-file) center center / 20px 20px
        no-repeat;
    }

    #controls #add-text:hover,
    #controls #add-image-file:hover,
    #controls #add-video-file:hover,
    #controls #add-audio-file:hover,
    #controls #add-text-file:hover,
    #controls #add-text:focus,
    #controls #add-image-file:focus,
    #controls #add-video-file:focus,
    #controls #add-audio-file:focus,
    #controls #add-text-file:focus {
      opacity: 1;
    }

    #container {
      resize: vertical;
      overflow: auto;
      height: 15vh;
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

    #no-parts {
      padding: 0 var(--bb-grid-size-3);
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

  #addFilePart(mimeType: string, triggerSelectionFlow = false) {
    if (!this.value) {
      this.value = { role: "user", parts: [] };
    }

    this.value.parts.push({ inlineData: { data: "", mimeType } });
    this.#focusLastPart = true;
    this.#triggerSelectionFlow = triggerSelectionFlow;
    this.requestUpdate();
  }

  #addImageFilePart() {
    this.#addFilePart("image-file", true);
  }

  #addVideoFilePart() {
    this.#addFilePart("video-file", true);
  }

  #addAudioFilePart() {
    this.#addFilePart("audio-file", true);
  }

  #addTextFilePart() {
    this.#addFilePart("text-file", true);
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

      // New File
      case "image-file":
      case "audio-file":
      case "video-file":
      case "text-file": {
        let accept = "image/*";
        switch (part.inlineData.mimeType) {
          case "text-file":
            accept = "text/plain";
            break;
          case "video-file":
            accept = "video/*";
            break;
          case "audio-file":
            accept = "audio/*";
            break;
        }

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

      default: {
        return html`<label for="part-${idx}"
          ><input type="file" id="part-${idx}"
        /></label>`;
      }
    }
  }

  render() {
    return html` <header>
        <span id="description">${this.schema?.description}</span>
        <span id="controls">
          <span>Insert:</span>
          <button id="add-text" @click=${this.#addTextPart}>Text</button>
          <button id="add-image-file" @click=${this.#addImageFilePart}>
            Image
          </button>
          <button id="add-video-file" @click=${this.#addVideoFilePart}>
            Video
          </button>
          <button id="add-audio-file" @click=${this.#addAudioFilePart}>
            Audio
          </button>
          <button id="add-text-file" @click=${this.#addTextFilePart}>
            Text File
          </button>
        </span>
      </header>
      <div id="container">
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

                if (part.inlineData.mimeType === "text/plain") {
                  prefix = "txt";
                }

                if (part.inlineData.mimeType.endsWith("-file")) {
                  prefix = "";
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
