/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, HTMLTemplateResult, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import {
  AddAssetEvent,
  AddAssetRequestEvent,
  InputEnterEvent,
  ResizeEvent,
  UtteranceEvent,
} from "../../../events/events";
import {
  isLLMContent,
  NodeValue,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";
import { repeat } from "lit/directives/repeat.js";
import {
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../../utils";
import { AssetShelf } from "../add-asset/asset-shelf";
import { maybeConvertToYouTube } from "../../../utils/substitute-input";
import { LLMContent } from "@breadboard-ai/types";
import { icons } from "../../../styles/icons";

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
  };
}

@customElement("bb-floating-input")
export class FloatingInput extends LitElement {
  @property()
  accessor schema: Schema | null = null;

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
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        max-width: 800px;
        width: 100%;
        opacity: 0;
        animation: fadeIn 0.8s cubic-bezier(0, 0, 0.3, 1) forwards;
      }

      #container {
        display: block;
        margin: var(--container-margin, 0);
        padding: var(--bb-grid-size-4);
        border-radius: var(--bb-grid-size-4);
        border: 1px solid var(--nv-50, var(--bb-neutral-500));
        background: var(--n-95, var(--bb-neutral-50));

        & bb-asset-shelf[populated] {
          margin-bottom: var(--bb-grid-size-4);
          margin-left: calc(var(--bb-grid-size-2) * -1);
          padding-left: var(--bb-grid-size-2);
          padding-bottom: var(--bb-grid-size-2);
        }

        & #input-container {
          display: flex;
          align-items: flex-end;
        }

        & .user-input {
          margin: 0 var(--bb-grid-size-2);
          flex: 1;

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
            background: var(--p-40, var(--bb-neutral-900));
            border: none;
            border-radius: 50%;
            color: var(--p-100, var(--bb-neutral-0));
            margin-left: var(--bb-grid-size-2);
          }
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

    return supportedActions;
  }

  #toLLMContentWithTextPart(text: string): NodeValue {
    return { role: "user", parts: [{ text }] };
  }

  #continueRun() {
    if (!this.container) {
      return;
    }

    const inputs = this.container.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea");
    const inputValues: OutputValues = {};

    let canProceed = true;
    for (const input of inputs) {
      if (!input.checkValidity()) {
        input.reportValidity();
        canProceed = false;
      }

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

    if (!canProceed) {
      return;
    }

    this.dispatchEvent(
      new InputEnterEvent(
        "unknown",
        inputValues,
        /* allowSavingIfSecret */ true
      )
    );
  }

  #hideAllModals() {
    this.showAddAssetModal = false;
    this.#addAssetType = null;
    this.#allowedMimeTypes = null;
  }

  protected firstUpdated(): void {
    if (!this.textInput) {
      return;
    }

    this.textInput.focus();
  }

  render() {
    let inputContents: HTMLTemplateResult | symbol = nothing;
    if (this.schema) {
      const props = Object.entries(this.schema.properties ?? {});
      const supportedActions = this.#determineSupportedActions(props);
      inputContents = html`
        ${supportedActions.allowAddAssets
          ? html`<bb-add-asset-button
              @bbaddassetrequest=${(evt: AddAssetRequestEvent) => {
                this.showAddAssetModal = true;
                this.#addAssetType = evt.assetType;
                this.#allowedMimeTypes = evt.allowedMimeTypes;
              }}
              .anchor=${"above"}
              .supportedActions=${supportedActions.actions}
              .allowedUploadMimeTypes=${supportedActions.allowedUploadMimeTypes}
              .showGDrive=${true}
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
          return html`<div class="user-input">
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
                      this.#continueRun();
                      return;
                    }
                  }}
                ></textarea>`
              : supportedActions.allowAddAssets
                ? html`<div class="no-text-input">
                      ${hasAssetEntered
                        ? "Upload your response."
                        : "Press Submit to continue"}
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
              this.#continueRun();
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
      html`<section id="container">
        <bb-asset-shelf
          @assetchanged=${() => {
            this.requestUpdate();
          }}
          id="asset-shelf"
        ></bb-asset-shelf>
        <section id="input-container">${inputContents}</section>
      </section>`,
      addAssetModal,
    ];
  }
}
