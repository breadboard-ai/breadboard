/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  LitElement,
  html,
  css,
  nothing,
  PropertyValues,
  HTMLTemplateResult,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { AllowedLLMContentTypes } from "../../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { cache } from "lit/directives/cache.js";
import type { AudioHandler } from "../audio/audio-handler.js";
import type { DrawableInput } from "../drawable/drawable.js";
import type { WebcamInput } from "../webcam/webcam.js";
import {
  asBase64,
  isFunctionCallCapabilityPart,
  isFunctionResponseCapabilityPart,
  isInlineData,
  isStoredData,
  isTextCapabilityPart,
  toInlineDataPart,
} from "@google-labs/breadboard";
import { styleMap } from "lit/directives/style-map.js";
import type {
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { Project } from "../../../state/types.js";
import { ContinueEvent } from "../../../events/events.js";
import { getGlobalColor } from "../../../utils/color.js";
import { repeat } from "lit/directives/repeat.js";
import { until } from "lit/directives/until.js";

const inlineDataTemplate = { inlineData: { data: "", mimeType: "" } };

const OVERFLOW_MENU_BUTTON_HEIGHT = 45;

type MultiModalInput = AudioHandler | DrawableInput | WebcamInput;

@customElement("bb-llm-input-chat")
export class LLMInputChat extends LitElement {
  @property()
  accessor pending = false;

  @property()
  accessor value: LLMContent | null = null;

  @property()
  accessor description: string | null = null;

  @property({ reflect: true })
  accessor clamped = true;

  @property()
  accessor minItems = 0;

  @property({ reflect: true })
  accessor audioWaveColor = getGlobalColor("--bb-ui-700");

  @property()
  accessor allow: AllowedLLMContentTypes = {
    audioFile: false,
    audioMicrophone: true,
    videoFile: false,
    videoWebcam: false,
    imageFile: true,
    imageWebcam: false,
    imageDrawable: false,
    textFile: false,
    textInline: true,
  };

  @state()
  accessor showInlineControls: { x: number; y: number } | null = null;

  @property()
  accessor autofocus = false;

  @property()
  accessor nodeId: string | null = null;

  @property()
  accessor subGraphId: string | null = null;

  @property()
  accessor projectState: Project | null = null;

  @property({ reflect: true })
  accessor showChatContinueButton = false;

  #forceRenderCount = 0;
  #focusLastPart = false;
  #triggerSelectionFlow = false;
  #textAreaRef: Ref<HTMLTextAreaElement> = createRef();
  #audioHandlerRef: Ref<AudioHandler> = createRef();
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
      height: 20px;
    }

    #description {
      color: var(--text-color, var(--bb-neutral-700));
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

      & > #insert {
        margin: 0 var(--bb-grid-size-2);
      }

      & button {
        width: 20px;
        height: 20px;
        opacity: 0.5;
        margin: 0 var(--bb-grid-size);
        border: none;
        border-radius: 0;
        font-size: 0;
        cursor: pointer;
        background: transparent var(--bb-icon-add-text) center center / 20px
          20px no-repeat;

        &#add-text {
          background-image: var(--bb-icon-add-text);
        }

        &#add-image-webcam {
          background-image: var(--bb-icon-add-image-webcam);
        }

        &#add-image-drawable {
          background-image: var(--bb-icon-add-drawable);
        }

        &#add-video-webcam {
          background-image: var(--bb-icon-add-video);
        }

        &#add-audio-microphone {
          background-image: var(--bb-icon-add-audio);
        }

        &#add-file {
          background-image: var(--bb-icon-add-file);
        }
      }

      &:hover,
      &:focus {
        opacity: 1;
      }
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

      & #controls {
        display: grid;
        grid-auto-rows: var(--bb-grid-size-11);
        row-gap: 1px;
        background: none;
        width: 180px;
        height: var(--controls-height, 224px);
        padding: 0;

        & button {
          display: flex;
          align-items: center;
          background: none;
          margin: 0;
          padding: var(--bb-grid-size-3) var(--bb-grid-size-3)
            var(--bb-grid-size-3) var(--bb-grid-size-8);
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
          opacity: 0.5;

          &#add-text {
            background-image: var(--bb-icon-add-text);
          }

          &#add-image-webcam {
            background-image: var(--bb-icon-add-image-webcam);
          }

          &#add-image-drawable {
            background-image: var(--bb-icon-add-drawable);
          }

          &#add-video-webcam {
            background-image: var(--bb-icon-add-video);
          }

          &#add-audio-microphone {
            background-image: var(--bb-icon-add-audio);
          }

          &#add-file {
            background-image: var(--bb-icon-add-file);
          }

          &:first-of-type {
            border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
          }

          &:last-of-type {
            border-bottom: none;
            border-radius: 0 0 var(--bb-grid-size-2) var(--bb-grid-size-2);
          }

          &:first-of-type:last-of-type {
            border-radius: var(--bb-grid-size-2);
          }

          &:hover,
          &:focus {
            background-color: var(--bb-neutral-50);
            opacity: 1;
          }
        }
      }
    }

    #insert {
      display: none;
    }

    #container {
      display: grid;
      grid-template-columns: 40px 1fr;
      column-gap: var(--bb-grid-size-2);
      position: relative;
      align-items: end;

      & header {
        grid-column: 1 / 3;
      }

      & #toggle-controls {
        padding: 0;
        width: 40px;
        height: 40px;
        border: none;
        background: var(--primary-color, var(--bb-neutral-50))
          var(--bb-icon-add) center center / 20px 20px no-repeat;
        border-radius: 50%;
        font-size: 0;
        cursor: pointer;
        transition:
          background-color 0.3s cubic-bezier(0, 0, 0.3, 1),
          opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
        align-self: end;
        opacity: 0.5;

        &:not([disabled]) {
          background-color: var(--primary-color, var(--bb-ui-50));

          &:hover,
          &:focus {
            background-color: var(--primary-color, var(--bb-ui-100));
            transition-duration: 0.1s;
            opacity: 1;
          }
        }
      }

      & #continue-control {
        padding: 0;
        display: block;
        background: var(--primary-color, var(--bb-ui-50)) var(--bb-icon-send-ui)
          center center / 20px 20px no-repeat;
        width: var(--bb-grid-size-10);
        height: var(--bb-grid-size-10);
        border-radius: 50%;
        font-size: 0;
        border: none;
        transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);

        &:not([disabled]) {
          cursor: pointer;

          &:focus,
          &:hover {
            background-color: var(--bb-ui-100);
          }
        }
      }
    }

    #audio-handler-placeholder {
      padding: 0;
      display: block;
      background: var(--primary-color, var(--bb-neutral-50)) var(--bb-icon-mic)
        center center / 20px 20px no-repeat;
      width: var(--bb-grid-size-10);
      height: var(--bb-grid-size-10);
      border-radius: 50%;
      font-size: 0;
      opactiy: 0.5;
    }

    input[type="file"] {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
      display: block;
    }

    :host([showchatcontinuebutton="true"]) #container {
      grid-template-columns: 40px 1fr 40px;

      & header {
        grid-column: 1 / 4;
      }
    }

    #no-input-needed {
      height: var(--bb-grid-size-10);
      display: flex;
      align-items: center;
      color: var(--text-color, var(--bb-neutral-700));
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      padding: 0;
    }

    #value-container {
      &:has(#no-parts) {
        display: flex;
        align-items: center;
      }
    }

    :host([clamped="true"]) #container {
      resize: vertical;
      overflow: auto;
      height: 160px;
      min-height: var(--bb-grid-size-6);
    }

    :host([inlinecontrols="true"]) #container {
      padding-right: var(--bb-grid-size-7);
      border-radius: var(--bb-grid-size);
    }

    .content {
      display: block;
    }

    .value {
      display: flex;
      flex-direction: column;
      position: relative;
      min-height: var(--bb-grid-size-9);
      font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      color: var(--bb-neutral-900);
      margin-left: 0;
      justify-content: center;
    }

    #primary-part {
      display: flex;
      padding-top: var(--bb-grid-size);
      align-items: flex-end;

      & textarea {
        background: transparent;
        font: normal var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        color: var(--text-color, var(--bb-neutral-900));
        white-space: pre-line;
        resize: none;
        field-sizing: content;
        margin: 0;
        padding: 0 0 var(--bb-grid-size-2) 0;
        border: none;
        width: 100%;
        outline: none;
        flex: 1 1 auto;
        line-height: 24px;

        max-height: max(20svh, 340px);
        overflow: auto;
        scrollbar-width: none;
        scroll-padding-bottom: 30px;

        &::placeholder {
          color: var(--text-color, var(--bb-neutral-900));
        }
      }

      & bb-audio-handler {
        --color-play-button: transparent;
        --color-play-button-active: transparent;
        --color-capture-button: var(--primary-color, var(--bb-ui-50));
        --color-capture-button-active: var(--primary-color, var(--bb-ui-100));
        --reset-text-color: var(--text-color, var(--bb-ui-700));
        --icon-play: var(--bb-icon-play-arrow-filled-ui);
        --icon-mic: var(--bb-icon-mic-ui);
        --icon-reset: var(--bb-icon-delete-ui);
        flex: 0 0 auto;
        width: var(--bb-grid-size-10);
      }
    }

    #primary-part:has(bb-audio-handler) {
      & textarea {
        margin-right: var(--bb-grid-size-2);
      }
    }

    #primary-part:has(bb-audio-handler[audioFile]),
    #primary-part:has(bb-audio-handler[state="recording"]) {
      & textarea {
        width: 0;
        flex: 0 1 auto;
        field-sizing: initial;
        line-height: 0;
        overflow: hidden;
        padding: 0;
      }

      & bb-audio-handler {
        flex: 1 0 auto;
      }
    }

    #other-parts {
      display: flex;
      overflow-x: scroll;
      scrollbar-width: none;

      & .part {
        position: relative;
        padding-top: 8px;
        margin-right: calc(var(--bb-grid-size-5) - 2px);
        margin-left: 2px;

        & .delete-part {
          position: absolute;
          top: 0;
          right: -8px;
          width: 28px;
          height: 28px;
          margin: 0;
          border: none;
          border-radius: 0;
          font-size: 0;
          cursor: pointer;
          border-radius: 50%;
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
          background: var(--bb-ui-50) var(--bb-icon-close-ui) center center /
            20px 20px no-repeat;

          &:hover,
          &:focus {
            background-color: var(--bb-ui-100);
          }
        }
      }
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
      width: 120px;
      height: 80px;
      object-fit: cover;
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
      margin: 0 var(--bb-grid-size-3);

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

    :host([inlinecontrols="true"]) #no-parts {
      margin-bottom: var(--bb-grid-size-2);
      min-height: var(--bb-grid-size-7);
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

  #controlsHeight = 0;
  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("allow")) {
      let allowable = Object.entries(this.allow).filter(([name, value]) => {
        // We exclude any files, inline text or mic audio because these will be
        // presented in the main area and don't need to be supported in the
        // overflow menu.
        return (
          value &&
          !name.endsWith("File") &&
          name !== "textInline" &&
          name !== "audioMicrophone"
        );
      }).length;

      const allowFile =
        this.allow.audioFile ||
        this.allow.imageFile ||
        this.allow.videoFile ||
        this.allow.textFile;
      if (allowFile) {
        allowable++;
      }

      // const allowsFile =
      this.#controlsHeight =
        Math.min(5, allowable) * OVERFLOW_MENU_BUTTON_HEIGHT;
      this.style.setProperty(
        "--controls-height",
        // Clamped to 5 because we don't currently support all allowable items
        // in the UI as yet.
        `${this.#controlsHeight}px`
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
      this.value = { role: "user", parts: [{ text: "" }] };
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
      const textarea = this.#lastPartRef.value.querySelector("textarea");
      if (textarea) {
        textarea.select();
        textarea.focus();
      }

      const lastPart = this.#lastPartRef.value;
      requestAnimationFrame(() => {
        lastPart.scrollIntoView({
          behavior: "smooth",
          block: "end",
          inline: "end",
        });
      });
    }

    if (triggerSelectionFlow) {
      requestAnimationFrame(() => {
        if (!this.#lastInputRef.value) {
          return;
        }

        this.#lastInputRef.value.addEventListener("cancel", () => {
          if (this.value && isInlineData(this.value.parts.at(-1))) {
            this.value.parts.pop();
            this.requestUpdate();
          }
        });

        this.#lastInputRef.value.click();
      });
    }
  }

  processAllOpenParts() {
    if (!this.value) {
      return;
    }

    this.value.parts.map((part, idx) => {
      if (!isInlineData(part)) {
        return;
      }

      switch (part.inlineData.mimeType) {
        case "audio-microphone":
        case "image-webcam":
        case "image-drawable": {
          return this.#processInputPart(idx, false);
        }
      }
    });
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

  #processInputPart(partIdx: number, emit = true) {
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

    if (!emit) {
      return;
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
    part: InlineDataCapabilityPart | StoredDataCapabilityPart
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

      case "audio/ogg":
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
          html`<bb-audio-handler
            .audioFile=${b}
            .color=${this.audioWaveColor}
            src="${url}"
            controls
          />`
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
            @input=${(evt: InputEvent) => {
              evt.preventDefault();
              evt.stopImmediatePropagation();

              this.#processFilePart(evt, idx);
            }}
            type="file"
            accept="${accept}"
            id="part-${idx}"
            ${ref(this.#lastInputRef)}
        /></label>`;
      }

      case "audio-microphone": {
        return cache(
          html`<bb-audio-handler
              .canRecord=${true}
              .color=${this.audioWaveColor}
              id="part-${idx}"
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
          ><input type="file" id="part-${idx}" ${ref(this.#lastInputRef)}
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
      styles.left = `${this.showInlineControls.x}px`;
      styles.top = `${this.showInlineControls.y - this.#controlsHeight}px`;
    }

    const renderedValues = html`<div id="primary-part">
        <textarea
          .placeholder=${"Type something"}
          ${ref(this.#textAreaRef)}
          @input=${(evt: Event) => {
            if (!(evt.target instanceof HTMLTextAreaElement)) {
              return;
            }

            if (!this.value) {
              this.value = { role: "user", parts: [{ text: "" }] };
            }

            if (!isTextCapabilityPart(this.value.parts[0])) {
              this.value.parts[0] = { text: "" };
            }

            this.value.parts[0].text = evt.target.value;
          }}
        ></textarea>
        ${this.allow.audioMicrophone
          ? html`<bb-audio-handler
              .canRecord=${true}
              .lite=${true}
              .color=${this.audioWaveColor}
              ${ref(this.#audioHandlerRef)}
            ></bb-audio-handler>`
          : nothing}
      </div>

      <div id="other-parts">
        ${this.value &&
        Array.isArray(this.value.parts) &&
        this.value.parts.length
          ? repeat(this.value.parts, (part, idx) => {
              // The first part is always handled in the primary input
              // area so we skip it here.
              if (idx === 0) {
                return nothing;
              }
              const isLastPart = idx === (this.value?.parts.length || 0) - 1;

              let partClass = "";
              let value: HTMLTemplateResult | symbol = nothing;
              if (isTextCapabilityPart(part)) {
                partClass = "text";
                value = html` <textarea
                  @input=${(evt: Event) => {
                    if (
                      !isTextCapabilityPart(part) ||
                      !(evt.target instanceof HTMLTextAreaElement)
                    ) {
                      return;
                    }

                    part.text = evt.target.value;
                  }}
                  .value=${part.text.trim()}
                ></textarea>`;
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
                  this.#getPartDataAsHTML(idx, part),
                  "Loading..."
                )}`;
              } else if (isInlineData(part)) {
                partClass = "inline-data";

                value = html`${until(
                  this.#getPartDataAsHTML(idx, part),
                  "Loading..."
                )}`;
              }

              return html`<div
                class=${classMap({ part: true, [partClass]: true })}
                ${isLastPart ? ref(this.#lastPartRef) : nothing}
              >
                <span class="value">${value}</span>
                <button
                  class="delete-part"
                  @click=${() => this.#deletePart(idx)}
                  title="Delete"
                >
                  Delete
                </button>
              </div>`;
            })
          : nothing}
      </div>`;

    return html` <div id="container">
        <header
          class=${classMap({ ["with-description"]: this.description !== null })}
        >
          ${this.description
            ? html`<div id="description">${this.description}</div>`
            : nothing}
        </header>
        <button
          id="toggle-controls"
          ?disabled=${this.pending}
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
        </button>
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
        <div id="value-container" ${ref(this.#containerRef)}>
          ${this.pending
            ? html`<div id="no-input-needed">No input needed</div>`
            : renderedValues}
        </div>
        ${!this.pending && this.showChatContinueButton
          ? html`<button
              id="continue-control"
              ?disabled=${this.pending}
              @click=${() => {
                if (this.#audioHandlerRef.value) {
                  if (this.#audioHandlerRef.value.audioFile) {
                    if (!this.value) {
                      this.value = { role: "user", parts: [] };
                    }

                    if (!isInlineData(this.value.parts[0])) {
                      this.value.parts[0] = { ...inlineDataTemplate };
                    }

                    const audioData =
                      this.#audioHandlerRef.value.value.parts[0];
                    if (
                      isInlineData(audioData) &&
                      audioData.inlineData.data.length > 0
                    ) {
                      this.value.parts[0].inlineData = audioData.inlineData;
                    }
                  } else if (this.#textAreaRef.value) {
                    if (!this.value) {
                      this.value = { role: "user", parts: [] };
                    }

                    this.value.parts[0] = {
                      text: this.#textAreaRef.value.value ?? "",
                    };
                  }
                }

                this.dispatchEvent(new ContinueEvent());
              }}
            >
              ->
            </button>`
          : this.pending &&
              this.showChatContinueButton &&
              this.allow.audioMicrophone
            ? html`<div id="audio-handler-placeholder"></div>`
            : nothing}
      </div>

      <div id="location-proxy" ${ref(this.#locationProxyRef)}></div>`;
  }
}
