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
  LLMInlineData,
  LLMStoredData,
} from "../../../types/types.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { until } from "lit/directives/until.js";
import { cache } from "lit/directives/cache.js";
import type { AudioInput } from "../audio/audio.js";
import type { DrawableInput } from "../drawable/drawable.js";
import type { WebcamInput } from "../webcam/webcam.js";
import {
  isFunctionCall,
  isFunctionResponse,
  isInlineData,
  isStoredData,
  isText,
} from "../../../utils/llm-content.js";
import { DataStore } from "@google-labs/breadboard";
import { consume } from "@lit/context";
import { dataStoreContext } from "../../../contexts/data-store.js";
import { asBase64 } from "../../../utils/as-base-64.js";

const inlineDataTemplate = { inlineData: { data: "", mimeType: "" } };

type MultiModalInput = AudioInput | DrawableInput | WebcamInput;

@customElement("bb-llm-input")
export class LLMInput extends LitElement {
  @property()
  value: LLMContent | null = null;

  @property()
  description: string | null = null;

  @property({ reflect: true })
  minimal = false;

  @property()
  minItems = 0;

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

  #forceRenderCount = 0;
  #focusLastPart = false;
  #triggerSelectionFlow = false;
  #lastPartRef: Ref<HTMLSpanElement> = createRef();
  #lastInputRef: Ref<HTMLInputElement> = createRef();
  #containerRef: Ref<HTMLDivElement> = createRef();

  #partDataURLs = new Map<number, string>();

  @consume({ context: dataStoreContext })
  @property({ attribute: false })
  public dataStore?: { instance: DataStore | null };

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    header {
      display: block;
    }

    #description {
      margin-bottom: var(--bb-grid-size-2);
    }

    #controls {
      color: var(--bb-neutral-700);
      display: flex;
      align-items: center;
      padding: var(--bb-grid-size);
      background: var(--bb-neutral-100);
      border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
      width: fit-content;
      height: var(--bb-grid-size-7);
    }

    #controls > #insert {
      margin: 0 var(--bb-grid-size-2);
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
      margin: 0 var(--bb-grid-size);
      border: none;
      border-radius: 0;
      font-size: 0;
      cursor: pointer;
    }

    #controls #add-text {
      background: transparent var(--bb-icon-add-text) center center / 20px 20px
        no-repeat;
    }

    #controls #add-image-webcam {
      background: transparent var(--bb-icon-add-image-webcam) center center /
        20px 20px no-repeat;
    }

    #controls #add-image-drawable {
      background: transparent var(--bb-icon-add-drawable) center center / 20px
        20px no-repeat;
    }

    #controls #add-video-webcam {
      background: transparent var(--bb-icon-add-video) center center / 20px 20px
        no-repeat;
    }

    #controls #add-audio-microphone {
      background: transparent var(--bb-icon-add-audio) center center / 20px 20px
        no-repeat;
    }

    #controls #add-file {
      background: transparent var(--bb-icon-add-file) center center / 20px 20px
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
      border: var(--bb-border-size, 2px) solid var(--bb-neutral-300);
      border-radius: 0 0 var(--bb-grid-size) var(--bb-grid-size);
      padding: var(--bb-grid-size-3) 0 var(--bb-grid-size) 0;
      background: #fff;
    }

    :host([minimal]) #container {
      height: 100px;
    }

    .content {
      display: block;
      margin-bottom: var(--bb-grid-size-2);
    }

    .part {
      position: relative;
      margin: 0 var(--bb-grid-size-3);
    }

    .part-controls {
      display: none;
      position: absolute;
      top: calc(var(--bb-grid-size-4) * -1 - 2px);
      right: calc(var(--bb-grid-size-2) * -1);
      height: var(--bb-grid-size-7);
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-8);
      border: 1px solid var(--bb-neutral-300);
      background: #fff;
    }

    .part:hover .part-controls {
      display: flex;
    }

    .part-controls .add-part-after,
    .part-controls .move-part-up,
    .part-controls .move-part-down,
    .part-controls .delete-part {
      width: 20px;
      height: 20px;
      opacity: 0.5;
      margin-right: var(--bb-grid-size);
      border: none;
      border-radius: 0;
      font-size: 0;
      cursor: pointer;
    }

    .part-controls .add-part-after {
      background: #fff var(--bb-icon-add) center center / 16px 16px no-repeat;
    }

    .part-controls .move-part-up {
      background: #fff var(--bb-icon-move-up) center center / 16px 16px
        no-repeat;
    }

    .part-controls .move-part-down {
      background: #fff var(--bb-icon-move-down) center center / 16px 16px
        no-repeat;
    }

    .part-controls .delete-part {
      background: #fff var(--bb-icon-delete) center center / 16px 16px no-repeat;
      margin-right: 0;
    }

    .part-controls .add-part-after:hover,
    .part-controls .move-part-up:hover,
    .part-controls .move-part-down:hover,
    .part-controls .delete-part:hover,
    .part-controls .add-part-after:focus,
    .part-controls .move-part-up:focus,
    .part-controls .move-part-down:focus,
    .part-controls .delete-part:focus {
      opacity: 1;
    }

    .part-controls .move-part-up[disabled],
    .part-controls .move-part-down[disabled] {
      opacity: 0.3;
      cursor: auto;
    }

    .value {
      display: flex;
      flex-direction: column;
      position: relative;
      padding: var(--bb-grid-size) var(--bb-grid-size) var(--bb-grid-size)
        var(--bb-grid-size-3);
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-900);
      margin-left: 0;
    }

    .value::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: var(--bb-grid-size-3);
      background: var(--bb-ui-100);
      width: 3px;
    }

    .part:hover {
      background: var(--bb-neutral-50);
    }

    .part:hover .value::before {
      background: var(--bb-ui-300);
    }

    .part:focus-within {
      background: var(--bb-ui-50);
    }

    .value textarea {
      background: transparent;
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-900);
      white-space: pre-line;
      resize: none;
      field-sizing: content;
      margin: 0;
      padding: 0;
      border: none;
      width: 100%;
      outline: none;
    }

    .value * {
      margin: var(--bb-grid-size) 0;
      background: transparent;
    }

    .value h1 {
      font-size: var(--bb-title-large);
      margin: calc(var(--bb-grid-size) * 4) 0 calc(var(--bb-grid-size) * 1) 0;
    }

    .value h2 {
      font-size: var(--bb-title-medium);
      margin: calc(var(--bb-grid-size) * 4) 0 calc(var(--bb-grid-size) * 1) 0;
    }

    .value h3,
    .value h4,
    .value h5 {
      font-size: var(--bb-title-small);
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
    }

    .value p {
      font-size: var(--bb-body-medium);
      margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
    }

    .value h1:first-of-type,
    .value h2:first-of-type,
    .value h3:first-of-type,
    .value h4:first-of-type,
    .value h5:first-of-type {
      margin-top: 0;
    }

    .value p:last-of-type {
      margin-bottom: 0;
    }

    .value img,
    .value video,
    .value audio {
      width: 100%;
      max-width: 320px;
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
      width: 100%;
      max-width: 320px;
    }

    .value bb-drawable-input {
      --bb-border-radius: var(--bb-grid-size);
      --bb-box-shadow: none;
      --bb-outline: var(--bb-neutral-300);
      width: 100%;
      max-width: 320px;
    }

    #no-parts {
      padding: 0 var(--bb-grid-size-3);

      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }

    #no-parts .add-text {
      background: var(--bb-continue-color);
      color: var(--bb-ui-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4);
      margin: 0;
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }

    .confirm {
      background: var(--bb-continue-color) var(--bb-icon-confirm-blue) 8px 4px /
        16px 16px no-repeat;
      color: var(--bb-ui-700);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.#clearPartDataURLs();
  }

  getContainerHeight(): number {
    if (!this.#containerRef.value) {
      return 0;
    }

    return this.#containerRef.value.getBoundingClientRect().height || 0;
  }

  setContainerHeight(height: number) {
    if (!this.#containerRef.value) {
      return;
    }

    this.#containerRef.value.style.height = `${height}px`;
  }

  hasMinItems(): boolean {
    if (!this.value) {
      return false;
    }

    return this.value.parts.length >= this.minItems;
  }

  #clearPartDataURLs() {
    for (const url of this.#partDataURLs.values()) {
      URL.revokeObjectURL(url);
    }

    this.#partDataURLs.clear();
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

  async processAllOpenParts(): Promise<void> {
    if (!this.value) {
      return;
    }

    await Promise.all([
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

    if (this.dataStore?.instance) {
      const store = this.dataStore.instance;
      this.value.parts[partIdx] = await store.store(files[0]);
    } else {
      if (!this.value.parts[partIdx]) {
        this.value.parts[partIdx] = structuredClone(inlineDataTemplate);
      }
      let part = this.value.parts[partIdx];

      if (!isInlineData(part)) {
        part = structuredClone(inlineDataTemplate);
      }

      part.inlineData.data = await asBase64(files[0]);
      part.inlineData.mimeType = files[0].type;
    }
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

  #move(idx: number, distance: number) {
    if (!this.value) {
      return;
    }

    if (idx + distance < 0 || idx + distance >= this.value.parts.length) {
      return;
    }

    const tempPart = this.value.parts[idx + distance];
    this.value.parts[idx + distance] = this.value.parts[idx];
    this.value.parts[idx] = tempPart;

    const tempUrlA = this.#partDataURLs.get(idx);
    const tempUrlB = this.#partDataURLs.get(idx + distance);
    if (tempUrlA && tempUrlB) {
      this.#partDataURLs.set(idx, tempUrlB);
      this.#partDataURLs.set(idx + distance, tempUrlA);
    }

    this.#forceReRender();
  }

  #addPartAfter(idx: number) {
    if (!this.value) {
      return;
    }

    this.value.parts.splice(idx + 1, 0, { text: "" });
    this.#forceReRender();
  }

  #movePartUp(idx: number) {
    this.#move(idx, -1);
  }

  #movePartDown(idx: number) {
    this.#move(idx, 1);
  }

  #deletePart(idx: number) {
    if (!this.value) {
      return;
    }

    this.value.parts.splice(idx, 1);
    if (this.value.parts.length === 0) {
      this.value = null;
    }
    this.#forceReRender();
  }

  #forceReRender() {
    this.#emitUpdate();
    this.#forceRenderCount++;
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
    part: LLMInlineData | LLMStoredData,
    isLastPart = false
  ) {
    let mimeType;
    let getData: () => Promise<string>;
    let url;
    if (isInlineData(part)) {
      url = this.#partDataURLs.get(idx);
      mimeType = part.inlineData.mimeType;
      getData = async () => atob(part.inlineData.data);
      if (!url && part.inlineData.data !== "") {
        const dataURL = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        const response = await fetch(dataURL);
        url = URL.createObjectURL(await response.blob());
        this.#partDataURLs.set(idx, url);
      }
    } else {
      url = part.storedData.handle;
      mimeType = part.storedData.mimeType;
      getData = async () => {
        const response = await this.dataStore?.instance?.retrieve(part);
        if (!response) {
          return "Unable to retrieve data";
        }
        return atob(response.inlineData.data);
      };
    }

    switch (mimeType) {
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
      case "audio/mp3":
      case "audio/mpeg": {
        return cache(html`<audio src="${url}" controls />`);
      }

      case "video/mp4":
      case "video/quicktime":
      case "video/webm": {
        return cache(html`<video src="${url}" controls />`);
      }

      case "text/plain": {
        // prettier-ignore
        return cache(html`<div class="plain-text">${await getData()}</div>`);
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
          html`<bb-audio-input id="part-${idx}"></bb-audio-input>
            <div>
              <button
                class="confirm"
                @click=${(evt: InputEvent) => {
                  evt.preventDefault();
                  evt.stopImmediatePropagation();

                  this.#processInputPart(idx);
                }}
              >
                Confirm
              </button>
            </div>`
        );
      }

      case "image-webcam": {
        return cache(
          html`<bb-webcam-input id="part-${idx}"></bb-webcam-input>
            <div>
              <button
                class="confirm"
                @click=${(evt: InputEvent) => {
                  evt.preventDefault();
                  evt.stopImmediatePropagation();

                  this.#processInputPart(idx);
                }}
              >
                Confirm
              </button>
            </div>`
        );
      }

      case "image-drawable": {
        return cache(
          html`<bb-drawable-input id="part-${idx}"></bb-drawable-input>
            <div>
              <button
                class="confirm"
                @click=${(evt: InputEvent) => {
                  evt.preventDefault();
                  evt.stopImmediatePropagation();

                  this.#processInputPart(idx);
                }}
              >
                Confirm
              </button>
            </div>`
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
        ${this.description
          ? html`<div id="description">${this.description}</div>`
          : nothing}
        <div id="controls-container">
          <div id="controls">
            <span id="insert">Insert:</span>
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
          </div>
        </div>
      </header>
      <div id="container" ${ref(this.#containerRef)}>
        ${this.value && this.value.parts.length
          ? map(this.value.parts, (part, idx) => {
              const isLastPart = idx === (this.value?.parts.length || 0) - 1;

              let partClass = "";
              let value: HTMLTemplateResult | symbol = nothing;
              if (isText(part)) {
                partClass = "text";
                value = html` <textarea
                  @input=${(evt: Event) => {
                    if (
                      !isText(part) ||
                      !(evt.target instanceof HTMLTextAreaElement)
                    ) {
                      return;
                    }

                    part.text = evt.target.value;
                  }}
                  .value=${part.text}
                  ${isLastPart ? ref(this.#lastPartRef) : nothing}
                ></textarea>`;
              } else if (isFunctionCall(part)) {
                partClass = "function-call";
                value = html`${part.functionCall.name}`;
              } else if (isFunctionResponse(part)) {
                partClass = "function-response";
                value = html`${part.functionResponse.name}
                ${JSON.stringify(part.functionResponse.response, null, 2)}`;
              } else if (isStoredData(part)) {
                // Steal the inline data class for now
                partClass = "inline-data";

                value = html`${until(
                  this.#getPartDataAsHTML(idx, part, isLastPart),
                  "Loading..."
                )}`;
              } else if (isInlineData(part)) {
                partClass = "inline-data";

                value = html`${until(
                  this.#getPartDataAsHTML(idx, part, isLastPart),
                  "Loading..."
                )}`;
              }

              return html`<div
                class=${classMap({ part: true, [partClass]: true })}
              >
                <div class="content">
                  <span class="value">${value}</span>
                </div>
                <div class="part-controls">
                  <button
                    class="add-part-after"
                    @click=${() => this.#addPartAfter(idx)}
                    title="Add part after"
                  >
                    Add part after
                  </button>
                  <button
                    class="move-part-up"
                    @click=${() => this.#movePartUp(idx)}
                    ?disabled=${idx === 0}
                    title="Move part up"
                  >
                    Move part up
                  </button>
                  <button
                    class="move-part-down"
                    @click=${() => this.#movePartDown(idx)}
                    ?disabled=${isLastPart}
                    title="Move part down"
                  >
                    Move part down
                  </button>
                  <button
                    class="delete-part"
                    @click=${() => this.#deletePart(idx)}
                    title="Delete part"
                  >
                    Delete part
                  </button>
                </div>
              </div>`;
            })
          : html`<div id="no-parts">
              No parts set.
              <button
                title="Add text field"
                class="add-text"
                @click=${this.#addTextPart}
              >
                Add a text part
              </button>
            </div>`}
      </div>`;
  }
}
