/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type {
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import {
  asBase64,
  isFileDataCapabilityPart,
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isInlineData,
  isStoredData,
  isTextCapabilityPart,
  Template,
  TemplatePartTransformCallback,
  toInlineDataPart,
} from "@google-labs/breadboard";
import {
  css,
  html,
  HTMLTemplateResult,
  LitElement,
  nothing,
  PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { cache } from "lit/directives/cache.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { until } from "lit/directives/until.js";
import { Project } from "../../../state/types.js";
import { AllowedLLMContentTypes } from "../../../types/types.js";
import type { AudioHandler } from "../audio/audio-handler.js";
import type { DrawableInput } from "../drawable/drawable.js";
import { TextEditor } from "../text-editor/text-editor.js";
import type { WebcamInput } from "../webcam/webcam.js";

const inlineDataTemplate = { inlineData: { data: "", mimeType: "" } };

const OVERFLOW_MENU_WIDTH = 180;
const OVERFLOW_MENU_BUTTON_HEIGHT = 45;

type MultiModalInput = AudioHandler | DrawableInput | WebcamInput;

@customElement("bb-llm-input")
export class LLMInput extends LitElement {
  @property()
  accessor value: LLMContent | null = null;

  @property()
  accessor description: string | null = null;

  @property({ reflect: true })
  accessor clamped = true;

  @property({ reflect: true, type: Boolean })
  accessor streamlined = false;

  @property({ reflect: true, type: Boolean })
  accessor showPartControls = true;

  @property()
  accessor minItems = 0;

  @property()
  accessor allow: AllowedLLMContentTypes = {
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

  @state()
  accessor showInlineControls: { x: number; y: number } | null = null;

  @property()
  accessor showInlineControlsToggle = true;

  @property()
  accessor autofocus = false;

  @property()
  accessor nodeId: string | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor projectState: Project | null = null;

  @property({ reflect: true, type: Boolean })
  accessor singleLine = false;

  #forceRenderCount = 0;
  #focusLastPart = false;
  #triggerSelectionFlow = false;
  #lastPartRef: Ref<HTMLSpanElement> = createRef();
  #lastInputRef: Ref<HTMLInputElement> = createRef();
  #containerRef: Ref<HTMLDivElement> = createRef();
  #controlsRef: Ref<HTMLDivElement> = createRef();
  #locationProxyRef: Ref<HTMLDivElement> = createRef();

  #partDataURLs = new Map<number, string>();
  #onWindowPointerDownBound = this.#onWindowPointerDown.bind(this);
  #onWindowKeyUpBound = this.#onWindowKeyUp.bind(this);

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      font: normal var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      position: relative;
    }

    header {
      display: block;
      position: relative;
    }

    header::empty {
      background: red;
      height: 20px;
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

    #controls button {
      width: 20px;
      height: 20px;
      opacity: 0.5;
      margin: 0 var(--bb-grid-size);
      border: none;
      border-radius: 0;
      font-size: 0;
      cursor: pointer;
      background: transparent var(--bb-icon-add-text) center center / 20px 20px
        no-repeat;
    }

    #controls #add-text {
      background-image: var(--bb-icon-add-text);
    }

    #controls #add-image-webcam {
      background-image: var(--bb-icon-add-image-webcam);
    }

    #controls #add-image-drawable {
      background-image: var(--bb-icon-add-drawable);
    }

    #controls #add-video-webcam {
      background-image: var(--bb-icon-add-video);
    }

    #controls #add-audio-microphone {
      background-image: var(--bb-icon-add-audio);
    }

    #controls #add-file {
      background-image: var(--bb-icon-add-file);
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

    #controls-container {
      position: fixed;
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      box-shadow:
        0px 4px 8px 3px rgba(0, 0, 0, 0.05),
        0px 1px 3px rgba(0, 0, 0, 0.1);
      z-index: 1;
    }

    #controls {
      display: grid;
      grid-auto-rows: var(--bb-grid-size-11);
      row-gap: 1px;
      background: none;
      width: 180px;
      height: var(--controls-height, 224px);
      padding: 0;
    }

    #insert {
      display: none;
    }

    #controls button {
      display: flex;
      align-items: center;
      background: none;
      margin: 0;
      padding: var(--bb-grid-size-3) var(--bb-grid-size-3) var(--bb-grid-size-3)
        var(--bb-grid-size-8);
      border: none;
      border-bottom: 1px solid var(--bb-neutral-300);
      text-align: left;
      cursor: pointer;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      width: auto;
      height: auto;
      background-position: var(--bb-grid-size-2) center;
      background-repeat: no-repeat;
      opacity: 1;
    }

    #controls button:hover,
    #controls button:focus {
      background-color: var(--bb-neutral-50);
    }

    #controls button:first-of-type {
      border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
    }

    #controls button:last-of-type {
      border-bottom: none;
      border-radius: 0 0 var(--bb-grid-size-2) var(--bb-grid-size-2);
    }

    #toggle-controls {
      position: absolute;
      width: 20px;
      height: 20px;
      background: var(--bb-ui-500) var(--bb-icon-add-inverted) center center /
        20px 20px no-repeat;
      border-radius: 50%;
      font-size: 0;
      border: none;
      bottom: calc(var(--bb-grid-size-9) * -1);
      right: var(--bb-grid-size-3);
      cursor: pointer;
      opacity: 0.75;
      transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    header.with-description #toggle-controls {
      bottom: calc(var(--bb-grid-size-11) * -1);
    }

    #toggle-controls:hover,
    #toggle-controls:focus {
      opacity: 1;
      transition-duration: 0.1s;
    }

    #container {
      border: 1px solid var(--bb-neutral-300);
      border-radius: 0 0 var(--bb-grid-size) var(--bb-grid-size);
      padding: var(--bb-grid-size-2) 0;
      background: var(--bb-neutral-0);
    }

    :host([clamped="true"]) #container {
      resize: vertical;
      overflow: auto;
      height: 160px;
      min-height: var(--bb-grid-size-6);
    }

    #container {
      padding-right: var(--bb-grid-size-7);
      border-radius: var(--bb-grid-size);
    }

    :host(:not([showpartcontrols])) {
      #container {
        padding-right: var(--bb-grid-size);
      }
    }

    .content {
      display: block;
      margin-bottom: var(--bb-grid-size-2);
    }

    .part {
      position: relative;
      margin: 0 var(--bb-grid-size-3);
      border-radius: var(--bb-grid-size);

      &:last-of-type {
        & .content {
          margin-bottom: 0;
        }
      }
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
      background: var(--bb-neutral-0);
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
      background: var(--bb-neutral-0) var(--bb-icon-add) center center / 16px
        16px no-repeat;
    }

    .part-controls .move-part-up {
      background: var(--bb-neutral-0) var(--bb-icon-move-up) center center /
        16px 16px no-repeat;
    }

    .part-controls .move-part-down {
      background: var(--bb-neutral-0) var(--bb-icon-move-down) center center /
        16px 16px no-repeat;
    }

    .part-controls .delete-part {
      background: var(--bb-neutral-0) var(--bb-icon-delete) center center / 16px
        16px no-repeat;
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

    .value textarea,
    .value input[type="text"],
    .value input[type="url"] {
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
      position: relative;
      margin: var(--bb-grid-size-3);
      min-height: var(--bb-grid-size-7);

      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }

    #no-parts .add-text {
      background: var(--bb-ui-500);
      color: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4);
      margin: 0;
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }

    .confirm {
      background: var(--bb-ui-500) var(--bb-icon-confirm-ui) 8px 4px / 16px 16px
        no-repeat;
      color: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-5);
      border: none;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-4) 0 var(--bb-grid-size-7);
      margin: var(--bb-grid-size-2) 0 var(--bb-grid-size) 0;
    }

    #location-proxy {
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
    }

    :host([streamlined]:not([singleline])) {
      --text-editor-height: 316px;
    }

    :host([streamlined]) {
      #container {
        border: 1px solid var(--bb-neutral-300);
        padding: 0;

        &:focus-within {
          border: 1px solid var(--bb-ui-700);
          outline: 1px solid var(--bb-ui-700);
        }

        & .part {
          margin: 0;

          &:hover,
          &:focus-within {
            background: var(--bb-neutral-0);
          }

          & .value {
            padding: 0;

            &::before {
              display: none;
            }
          }
        }
      }
    }
  `;

  #onWindowPointerDown() {
    if (!this.showInlineControls) {
      return;
    }

    this.showInlineControls = null;
  }

  #onWindowKeyUp(evt: KeyboardEvent) {
    if (!this.showInlineControls) {
      return;
    }

    if (evt.key === "Enter") {
      return;
    }

    if (!this.shadowRoot || !this.#controlsRef.value) {
      return;
    }

    // If there's no active element in this shadow root or if it has moved to
    // outside the controls, hide the overflow menu.
    if (
      !this.shadowRoot.activeElement ||
      this.shadowRoot.activeElement.parentElement !== this.#controlsRef.value
    ) {
      this.showInlineControls = null;
      return;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#clearPartDataURLs();

    window.addEventListener("click", this.#onWindowPointerDownBound);
    window.addEventListener("keyup", this.#onWindowKeyUpBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.removeEventListener("click", this.#onWindowPointerDownBound);
    window.removeEventListener("keyup", this.#onWindowKeyUpBound);
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("allow")) {
      const allowable = Object.values(this.allow).filter(
        (value) => value
      ).length;
      this.style.setProperty(
        "--controls-height",
        // Clamped to 5 because we don't currently support all allowable items
        // in the UI as yet.
        `${Math.min(5, allowable) * OVERFLOW_MENU_BUTTON_HEIGHT}px`
      );
    }

    if (changedProperties.has("autofocus")) {
      this.#focusLastPart = true;
      this.#triggerSelectionFlow = true;
    }
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

    this.showInlineControls = null;
    this.value.parts.push({ text: "" });
    this.#focusLastPart = true;

    this.#forceReRender();
    this.requestUpdate();
  }

  #addPart(mimeType: string, triggerSelectionFlow = true) {
    if (!this.value) {
      this.value = { role: "user", parts: [] };
    }

    this.showInlineControls = null;
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

  processAllOpenParts(componentParamCallback: TemplatePartTransformCallback) {
    if (!this.value) {
      return;
    }

    this.value.parts.map((part, idx) => {
      if (isTextCapabilityPart(part)) {
        return this.#updateComponentParamsInText(part, componentParamCallback);
      }

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
    });
  }

  /**
   * If necessary, updates the text parts that contain parameterized references
   * to components.
   * @param part
   */
  #updateComponentParamsInText(
    part: TextCapabilityPart,
    callback: TemplatePartTransformCallback
  ) {
    part.text = new Template(part.text).transform(callback);
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
    this.#partDataURLs.delete(partIdx);

    this.#emitUpdate();
    this.requestUpdate();
  }

  #processInputPart(partIdx: number) {
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
        this.#partDataURLs.delete(partIdx);
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

    this.#partDataURLs.delete(idx);
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
    part: InlineDataCapabilityPart | StoredDataCapabilityPart,
    isLastPart = false
  ) {
    let mimeType;
    let getData: () => Promise<string>;
    let url: string | undefined;
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
        const response = await toInlineDataPart(part);
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
        if (!url) {
          return html`[No audio provided]`;
        }

        const r = await fetch(url);
        const b = await r.blob();
        return cache(
          html`<bb-audio-handler .audioFile=${b} src="${url}" controls />`
        );
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
          html`<bb-audio-handler
              id="part-${idx}"
              .canRecord=${true}
            ></bb-audio-handler>
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

    const styles: Record<string, string> = {};
    if (this.showInlineControls) {
      styles.left = `${this.showInlineControls.x - OVERFLOW_MENU_WIDTH}px`;
      styles.top = `${this.showInlineControls.y}px`;
    }

    return html` <header
        class=${classMap({ ["with-description"]: this.description !== null })}
      >
        ${this.description
          ? html`<div id="description">${this.description}</div>`
          : nothing}
        ${this.showInlineControlsToggle
          ? html`<button
              id="toggle-controls"
              @click=${(evt: PointerEvent) => {
                evt.stopImmediatePropagation();

                if (this.showInlineControls) {
                  this.showInlineControls = null;
                  return;
                }

                if (!this.#locationProxyRef.value) {
                  return;
                }

                const containerBounds =
                  this.#locationProxyRef.value.getBoundingClientRect();
                const buttonBounds = (
                  evt.target as HTMLElement
                ).getBoundingClientRect();

                this.showInlineControls = {
                  x: buttonBounds.left - containerBounds.left,
                  y: buttonBounds.top - containerBounds.top,
                };
              }}
            >
              Toggle
            </button>`
          : nothing}
        ${this.showInlineControls
          ? html` <div
              id="controls-container"
              class=${classMap({ inline: this.showInlineControls !== null })}
              style=${styleMap(styles)}
              @click=${(evt: Event) => {
                evt.stopImmediatePropagation();
              }}
            >
              <div id="controls" ${ref(this.#controlsRef)}>
                <span id="insert">Insert:</span>
                ${this.allow.textInline
                  ? html`<button
                      title="Add text"
                      id="add-text"
                      @click=${this.#addTextPart}
                    >
                      Add text
                    </button>`
                  : nothing}
                ${this.allow.imageWebcam
                  ? html`<button
                      title="Add webcam image"
                      id="add-image-webcam"
                      @click=${() => this.#addPart("image-webcam")}
                    >
                      Add webcam image
                    </button>`
                  : nothing}
                ${this.allow.imageDrawable
                  ? html`<button
                      title="Add drawing"
                      id="add-image-drawable"
                      @click=${() => this.#addPart("image-drawable")}
                    >
                      Add drawing
                    </button>`
                  : nothing}
                ${this.allow.audioMicrophone
                  ? html`<button
                      title="Add audio from microphone"
                      id="add-audio-microphone"
                      @click=${() => this.#addPart("audio-microphone")}
                    >
                      Add audio
                    </button>`
                  : nothing}
                ${allowFile
                  ? html`<button
                      title="Add file"
                      id="add-file"
                      @click=${() => this.#addPart("file")}
                    >
                      Add file
                    </button>`
                  : nothing}
              </div>
            </div>`
          : nothing}
      </header>
      <div id="container" ${ref(this.#containerRef)}>
        ${this.value &&
        Array.isArray(this.value.parts) &&
        this.value.parts.length
          ? map(this.value.parts, (part, idx) => {
              const isLastPart = idx === (this.value?.parts.length || 0) - 1;

              let partClass = "";
              let value: HTMLTemplateResult | symbol = nothing;
              if (isTextCapabilityPart(part)) {
                partClass = "text";
                value = html` <bb-text-editor
                  .nodeId=${this.nodeId}
                  .subGraphId=${this.subGraphId}
                  .projectState=${this.projectState}
                  .supportsFastAccess=${!this.singleLine}
                  @input=${(evt: Event) => {
                    if (!isTextCapabilityPart(part)) {
                      return;
                    }

                    const target = evt.target as TextEditor;
                    part.text = target.value;
                  }}
                  .value=${part.text.trim()}
                  ${isLastPart ? ref(this.#lastPartRef) : nothing}
                ></bb-text-editor>`;
              } else if (isFunctionCallCapabilityPart(part)) {
                partClass = "function-call";
                value = html`${part.functionCall.name}`;
              } else if (isFunctionResponseCapabilityPart(part)) {
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
              } else if (isFileDataCapabilityPart(part)) {
                partClass = "file-data";

                value = html`<input
                  type="url"
                  .value=${part.fileData.fileUri}
                  @input=${(evt: Event) => {
                    if (!isFileDataCapabilityPart(part)) {
                      return;
                    }

                    const target = evt.target as HTMLInputElement;
                    part.fileData.fileUri = target.value;
                  }}
                />`;
              }

              return html`<div
                class=${classMap({ part: true, [partClass]: true })}
              >
                <div class="content">
                  <span class="value">${value}</span>
                </div>
                ${this.showPartControls
                  ? html`<div class="part-controls">
                      <button
                        class="add-part-after"
                        @click=${() => this.#addPartAfter(idx)}
                        title="Add text after"
                      >
                        Add text after
                      </button>
                      <button
                        class="move-part-up"
                        @click=${() => this.#movePartUp(idx)}
                        ?disabled=${idx === 0}
                        title="Move up"
                      >
                        Move up
                      </button>
                      <button
                        class="move-part-down"
                        @click=${() => this.#movePartDown(idx)}
                        ?disabled=${isLastPart}
                        title="Move down"
                      >
                        Move down
                      </button>
                      <button
                        class="delete-part"
                        @click=${() => this.#deletePart(idx)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>`
                  : nothing}
              </div>`;
            })
          : html`<div id="no-parts">
              <button
                title="Add text"
                class="add-text"
                @click=${this.#addTextPart}
              >
                Add text
              </button>
            </div>`}
      </div>

      <div id="location-proxy" ${ref(this.#locationProxyRef)}></div>`;
  }
}
