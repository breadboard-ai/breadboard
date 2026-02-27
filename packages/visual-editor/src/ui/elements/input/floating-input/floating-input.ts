/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  AddAssetEvent,
  AddAssetRequestEvent,
  ResizeEvent,
  StateEvent,
  UtteranceEvent,
} from "../../../events/events.js";
import { repeat } from "lit/directives/repeat.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../../../utils/schema/behaviors.js";
import { AssetShelf } from "../add-asset/asset-shelf.js";
import { maybeConvertToYouTube } from "../../../utils/substitute-input.js";
import {
  InputValues,
  LLMContent,
  NodeValue,
  OutputValues,
  Schema,
} from "@breadboard-ai/types";
import { icons } from "../../../styles/icons.js";
import { type } from "../../../styles/host/type.js";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { FloatingInputFocusState } from "../../../types/types.js";
import {
  isFileDataCapabilityPart,
  isInlineData,
  isLLMContent,
  isStoredData,
  isTextCapabilityPart,
} from "../../../../data/common.js";
import { parseUrl } from "../../../navigation/urls.js";
import { createRef, ref } from "lit/directives/ref.js";
import { SignalWatcher } from "@lit-labs/signals";
import { scaContext } from "../../../../sca/context/context.js";
import { type SCA } from "../../../../sca/sca.js";
import { NOTEBOOKLM_MIMETYPE, toNotebookLmUrl } from "@breadboard-ai/utils";

/**
 * Sentinel value that signals a skip action.
 * Must match the SKIPPED_SENTINEL in chat.ts.
 */
const SKIPPED_SENTINEL = "__skipped__";

interface SupportedActions {
  allowAddAssets: boolean;
  allowedUploadMimeTypes: string | null;
  speechToText: boolean;
  textInput: boolean;
  actions: {
    upload: boolean;
    youtube: boolean;
    drawable: boolean;
    gdrive: boolean;
    webcamVideo: boolean;
    notebooklm: boolean;
  };
}

const parsedUrl = parseUrl(window.location.href);

@customElement("bb-floating-input")
export class FloatingInput extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property()
  accessor schema: Schema | null = null;

  @property()
  accessor focusWhenIn: FloatingInputFocusState = ["app"];

  @property()
  accessor disclaimerContent: HTMLTemplateResult | string | null = null;

  @property()
  accessor skipLabel: string | null = null;

  @property({ reflect: true, type: Boolean })
  accessor neutral = false;

  @query("#asset-shelf")
  accessor assetShelf: AssetShelf | null = null;

  @query("#text-input")
  accessor textInput: HTMLTextAreaElement | null = null;

  @query("#container")
  accessor container: HTMLElement | null = null;

  @state()
  accessor showAddAssetModal = false;

  static styles = [
    icons,
    type,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
        opacity: 0;
        animation: fadeIn 0.8s cubic-bezier(0, 0, 0.3, 1) forwards;
      }

      #disclaimer {
        margin: 0 auto;
        font: 400 14px / 1.3 var(--bb-font-family);
        color: light-dark(var(--s-30), var(--p-80));
        text-align: center;
        padding: var(--bb-grid-size-2) 0 0 0;
        background: light-dark(var(--s-90), var(--p-30));
        max-width: 80%;

        & a {
          text-decoration: none;
          font-weight: 500;
          color: var(--light-dark-s-30);
        }
      }

      #container {
        display: block;
        width: calc(
          100% - var(--bb-floating-input-margin, var(--bb-grid-size-12))
        );
        max-width: 960px;
        margin: 0 auto;
        padding: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-4);
        border: 1px solid light-dark(var(--nv-80), var(--nv-35));
        background: light-dark(var(--n-95), var(--n-10));

        & bb-asset-shelf[populated] {
          margin-bottom: var(--bb-grid-size-4);
          margin-left: calc(var(--bb-grid-size-2) * -1);
          padding-left: var(--bb-grid-size-2);
          padding-bottom: var(--bb-grid-size-2);
        }

        & #input-container {
          display: flex;
          align-items: flex-end;
          position: relative;

          & #reporting-button {
            position: absolute;
            overflow: hidden;
            width: 2px;
            height: 2px;
            bottom: -4px;
            left: 50%;
            padding: 0;
            margin: 0;
            border: none;
            background: transparent;
          }
        }

        & .user-input {
          margin: 0 var(--bb-grid-size-2);
          flex: 1;
          overflow: hidden;
          min-height: var(--bb-grid-size-10);
          display: flex;
          align-items: center;

          &.vertical {
            flex-direction: column;
            align-items: start;
          }

          p {
            margin: 0 0 var(--bb-grid-size-2) 0;
          }

          textarea {
            background: transparent;
            border: none;
            border-radius: var(--bb-grid-size);
            field-sizing: content;
            max-height: var(--bb-grid-size-15);
            font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
              var(--bb-font-family);
            resize: none;
            outline: none;
            width: 100%;
            scrollbar-width: none;
            color: light-dark(var(--p-35), var(--nv-95));
          }
        }

        & .controls {
          display: flex;
          align-items: center;

          #continue {
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--p-40);
            border: none;
            border-radius: 50%;
            color: var(--p-100);
            margin-left: var(--bb-grid-size-2);

            &:not([disabled]) {
              cursor: pointer;
            }
          }
        }
      }

      #skip-container {
        display: flex;
        justify-content: flex-end;
        width: calc(
          100% - var(--bb-floating-input-margin, var(--bb-grid-size-12))
        );
        max-width: 960px;
        margin: 0 auto;
        padding: 0 0 var(--bb-grid-size-4) 0;

        & button {
          cursor: pointer;
          font-family: var(--a2ui-font-family-flex, var(--bb-font-family));
          font-weight: 500;
          font-style: normal;
          height: var(--a2ui-button-height, 40px);
          padding: var(--a2ui-button-padding, 0 16px);
          border-radius: var(--a2ui-button-radius, 20px);
          border: 1px solid var(--n-60);
          background: transparent;
          color: var(
            --a2ui-button-color,
            light-dark(var(--p-20), var(--n-100))
          );
          overflow: hidden;
          position: relative;
          transition: background var(--a2ui-transition-speed, 0.2s) ease;

          &:hover {
            background: var(--a2ui-button-hover-bg, var(--light-dark-n-100));
          }
        }
      }

      bb-speech-to-text,
      bb-add-asset-button {
        --text-color: light-dark(var(--p-40), var(--n-95));
        --background-color: light-dark(var(--n-90), var(--n-20));
      }

      :host([neutral]) {
        & #disclaimer {
          background: transparent;
          color: light-dark(var(--n-30), var(--n-80));
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  readonly #reportingButton = createRef<HTMLButtonElement>();
  #addAssetType: string | null = null;
  #allowedMimeTypes: string | null = null;
  #resizeObserver = new ResizeObserver((entries) => {
    const newest = entries.at(-1);
    if (!newest) {
      return;
    }

    this.dispatchEvent(new ResizeEvent(newest.contentRect));
  });

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    this.#resizeObserver.disconnect();
  }

  /**
   * Resolves the current input with the skip sentinel, which bubbles
   * back through the resolve chain to chat.ts where it becomes { skipped: true }.
   */
  #skipInput(): void {
    if (!this.schema) return;
    const props = Object.entries(this.schema.properties ?? {});
    if (!props.length) return;

    const [name] = props[0];
    const inputValues: OutputValues = {
      [name]: { role: "user", parts: [{ text: SKIPPED_SENTINEL }] },
    };

    this.dispatchEvent(
      new StateEvent({
        eventType: "board.input",
        id: "unknown",
        data: inputValues,
        allowSavingIfSecret: true,
      })
    );
  }

  #attemptNotebookLMPickerFlow() {
    this.sca.actions.notebookLmPicker.open((notebooks) => {
      if (!this.assetShelf) return;
      for (const notebook of notebooks) {
        const asset: LLMContent = {
          role: "user",
          parts: [
            {
              storedData: {
                handle: toNotebookLmUrl(notebook.id),
                mimeType: NOTEBOOKLM_MIMETYPE,
              },
            },
          ],
        };
        this.assetShelf.addAsset(asset);
      }
    });
  }

  #determineSupportedActions(props: [string, Schema][]): SupportedActions {
    const supportedActions: SupportedActions = {
      allowAddAssets: false,
      allowedUploadMimeTypes: null,
      speechToText: false,
      textInput: false,
      actions: {
        upload: false,
        youtube: false,
        drawable: false,
        gdrive: false,
        webcamVideo: false,
        notebooklm: false,
      },
    };

    if (!props.length) {
      return supportedActions;
    }

    for (const [, prop] of props) {
      if (!prop.format) {
        continue;
      }

      switch (prop.format) {
        case "upload": {
          supportedActions.allowAddAssets = true;
          supportedActions.actions.upload = true;
          supportedActions.actions.gdrive = true;
          return supportedActions;
        }

        case "mic": {
          supportedActions.allowAddAssets = true;
          supportedActions.allowedUploadMimeTypes = "audio/*";
          supportedActions.actions.upload = true;
          return supportedActions;
        }

        case "videocam": {
          supportedActions.allowAddAssets = true;
          supportedActions.allowedUploadMimeTypes = "video/*";
          supportedActions.actions.upload = true;
          supportedActions.actions.youtube = true;
          supportedActions.actions.gdrive = true;
          supportedActions.actions.webcamVideo = true;
          return supportedActions;
        }

        case "image": {
          supportedActions.allowAddAssets = true;
          supportedActions.allowedUploadMimeTypes = "image/*";
          supportedActions.actions.upload = true;
          return supportedActions;
        }

        case "edit_note": {
          supportedActions.allowAddAssets = true;
          supportedActions.allowedUploadMimeTypes = "text/*";
          supportedActions.actions.upload = true;
          supportedActions.speechToText = true;
          supportedActions.textInput = true;
          return supportedActions;
        }

        default: {
          // Any.
          supportedActions.allowAddAssets = true;
          supportedActions.speechToText = true;
          supportedActions.textInput = true;
          supportedActions.actions.upload = true;
          supportedActions.actions.youtube = true;
          supportedActions.actions.drawable = true;
          supportedActions.actions.gdrive = true;
          supportedActions.actions.webcamVideo = true;
          supportedActions.actions.notebooklm = true;
          return supportedActions;
        }
      }
    }

    // Default to everything on.
    supportedActions.allowAddAssets = true;
    supportedActions.speechToText = true;
    supportedActions.textInput = true;
    supportedActions.actions.upload = true;
    supportedActions.actions.youtube = true;
    supportedActions.actions.drawable = true;
    supportedActions.actions.gdrive = true;
    supportedActions.actions.webcamVideo = true;
    supportedActions.actions.notebooklm = true;

    return supportedActions;
  }

  #toLLMContentWithTextPart(text: string): NodeValue {
    return { role: "user", parts: [{ text }] };
  }

  #maybeContinueRun() {
    if (!this.container) {
      return;
    }

    const inputs = this.container.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea");
    const inputValues: OutputValues = {};

    for (const input of inputs) {
      let value: string | LLMContent = input.value;
      if (typeof value === "string") {
        value = maybeConvertToYouTube(input.value);
      }

      if (typeof value === "string") {
        if (input.dataset.type === "llm-content") {
          inputValues[input.name] =
            input.dataset.empty === "true"
              ? { parts: [] }
              : this.#toLLMContentWithTextPart(value);
        } else if (input.dataset.type === "llm-content-array") {
          inputValues[input.name] = [this.#toLLMContentWithTextPart(value)];
        } else {
          inputValues[input.name] = value;
        }

        value = "";
      } else {
        inputValues[input.name] = value as NodeValue;
      }

      if (this.assetShelf && this.assetShelf.value) {
        const inputValue = inputValues[input.name];
        if (isLLMContent(inputValue)) {
          const parts = inputValue.parts;
          for (const asset of this.assetShelf.value) {
            parts.push(...asset.parts);
          }
        }

        // Once we have the values, remove the items from the shelf.
        this.assetShelf.clear();
      }
    }

    if (!this.#reportingButton.value) {
      console.warn(
        "Wanted to handle validity, but continue button is unavailable"
      );
      return;
    }

    this.#reportingButton.value.setCustomValidity("");
    this.#reportingButton.value.reportValidity();
    if (!this.#canSubmit(inputValues)) {
      this.#reportingButton.value.setCustomValidity(
        Strings.from("ERROR_INPUT_REQUIRED")
      );
      this.#reportingButton.value.reportValidity();
      return;
    }

    if (this.textInput) {
      this.textInput.value = "";
    }

    this.dispatchEvent(
      new StateEvent({
        eventType: "board.input",
        id: "unknown",
        data: inputValues,
        allowSavingIfSecret: true,
      })
    );
  }

  #hideAllModals() {
    this.showAddAssetModal = false;
    this.#addAssetType = null;
    this.#allowedMimeTypes = null;
  }

  protected firstUpdated(): void {
    // Ensure we only attempt to focus a visible text input.
    if (!this.textInput) {
      return;
    }

    let attemptFocus = false;
    if (this.focusWhenIn[0] === this.sca.controller.global.main.mode) {
      if (
        this.focusWhenIn[1] !== undefined &&
        this.sca.controller.editor.sidebar.section === this.focusWhenIn[1]
      ) {
        attemptFocus = true;
      } else if (this.focusWhenIn[1] === undefined) {
        attemptFocus = true;
      }
    }

    if (!attemptFocus) {
      return;
    }

    this.textInput.focus();
  }

  #isPopulated(inputValue: NodeValue) {
    if (isLLMContent(inputValue)) {
      return inputValue.parts.some((part) => {
        if (isTextCapabilityPart(part)) {
          return part.text.trim() !== "";
        } else if (isInlineData(part)) {
          return part.inlineData.data !== "";
        } else if (isStoredData(part)) {
          return part.storedData.handle !== "";
        } else if (isFileDataCapabilityPart(part)) {
          return part.fileData.fileUri !== "";
        }
        return true;
      });
    } else if (typeof inputValue === "string") {
      return inputValue !== "";
    }

    return true;
  }

  #canSubmit(inputValues: InputValues) {
    if (!this.schema) return false;
    const props = Object.entries(this.schema.properties ?? {});
    for (const [name, prop] of props) {
      if (prop.behavior?.includes("hint-required")) {
        if (this.#isPopulated(inputValues[name])) {
          continue;
        }

        return false;
      }
    }
    return true;
  }

  render() {
    let inputContents: HTMLTemplateResult | symbol = nothing;
    const showGDrive =
      !parsedUrl.lite ||
      !!this.sca.env.flags.get("enableDrivePickerInLiteMode");
    const showNotebookLm = !!this.sca.env.flags.get("enableNotebookLm");
    if (this.schema) {
      const props = Object.entries(this.schema.properties ?? {});
      const supportedActions = this.#determineSupportedActions(props);
      inputContents = html`
        ${supportedActions.allowAddAssets
          ? html`<bb-add-asset-button
              @bbaddassetrequest=${(evt: AddAssetRequestEvent) => {
                if (evt.assetType === "notebooklm") {
                  this.#attemptNotebookLMPickerFlow();
                  return;
                }
                this.showAddAssetModal = true;
                this.#addAssetType = evt.assetType;
                this.#allowedMimeTypes = evt.allowedMimeTypes;
              }}
              .anchor=${"above"}
              .supportedActions=${supportedActions.actions}
              .allowedUploadMimeTypes=${supportedActions.allowedUploadMimeTypes}
              .showGDrive=${showGDrive}
              .showNotebookLm=${showNotebookLm}
            ></bb-add-asset-button>`
          : nothing}
        ${repeat(props, ([name, schema]) => {
          const dataType = isLLMContentArrayBehavior(schema)
            ? "llm-content-array"
            : isLLMContentBehavior(schema)
              ? "llm-content"
              : "string";

          const hasAssetEntered =
            this.assetShelf === null || this.assetShelf.value.length === 0;
          return html`<div
            class=${classMap({
              "user-input": true,
              vertical: schema.description !== undefined,
            })}
          >
            ${schema.description ? html`<p>${schema.description}</p>` : nothing}
            ${supportedActions.textInput
              ? html`<textarea
                  placeholder=${hasAssetEntered
                    ? "Type or upload your response."
                    : "Press Submit to continue"}
                  name=${name}
                  id="text-input"
                  type="text"
                  data-type=${dataType}
                  @keydown=${(evt: KeyboardEvent) => {
                    if (evt.key === "Enter" && !evt.shiftKey) {
                      evt.preventDefault();
                      this.#maybeContinueRun();
                      return;
                    }
                  }}
                ></textarea>`
              : supportedActions.allowAddAssets
                ? html`<div class="no-text-input">
                      ${hasAssetEntered
                        ? "Upload your response."
                        : "Press send to continue"}
                    </div>
                    <input
                      type="hidden"
                      data-type=${dataType}
                      data-empty="true"
                      name=${name}
                    />`
                : nothing}
          </div>`;
        })}

        <div class="controls">
          ${supportedActions.speechToText
            ? html`<bb-speech-to-text
                @bbutterance=${(evt: UtteranceEvent) => {
                  if (!this.textInput) {
                    return;
                  }

                  this.textInput.value = evt.parts
                    .map((part) => part.transcript)
                    .join("");
                }}
              ></bb-speech-to-text>`
            : nothing}
          <button
            id="continue"
            title="Submit"
            @click=${() => {
              this.#maybeContinueRun();
            }}
          >
            <span class="g-icon filled">send</span>
          </button>
        </div>
      `;
    } else {
      inputContents = html`Unexpected error: item provided with no schema`;
    }

    let addAssetModal: HTMLTemplateResult | symbol = nothing;
    if (this.showAddAssetModal) {
      addAssetModal = html`<bb-add-asset-modal
        .assetType=${this.#addAssetType}
        .allowedMimeTypes=${this.#allowedMimeTypes}
        @bboverlaydismissed=${() => {
          this.#hideAllModals();
        }}
        @bbaddasset=${(evt: AddAssetEvent) => {
          if (!this.assetShelf) {
            return;
          }

          this.#hideAllModals();
          this.assetShelf.addAsset(evt.asset);
        }}
      ></bb-add-asset-modal>`;
    }

    return [
      this.skipLabel
        ? html`<div id="skip-container">
            <button
              @click=${() => {
                this.#skipInput();
              }}
            >
              ${this.skipLabel}
            </button>
          </div>`
        : nothing,
      html`<section id="container">
        <bb-asset-shelf
          @assetchanged=${() => {
            this.requestUpdate();
          }}
          id="asset-shelf"
        ></bb-asset-shelf>
        <section id="input-container">
          ${inputContents}
          <button
            tabindex="-1"
            ${ref(this.#reportingButton)}
            id="reporting-button"
          >
            Reporting Button
          </button>
        </section>
      </section>`,
      addAssetModal,
      this.disclaimerContent
        ? html`<p id="disclaimer">${this.disclaimerContent}</p>`
        : nothing,
    ];
  }
}
