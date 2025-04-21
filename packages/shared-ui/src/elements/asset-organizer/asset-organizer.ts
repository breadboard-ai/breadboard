/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("AssetOrganizer");

import { css, LitElement, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Signal, SignalWatcher, html } from "@lit-labs/signals";
import { GraphAsset, Organizer } from "../../state";
import {
  AssetMetadata,
  AssetPath,
  JsonSerializable,
  LLMContent,
  NodeValue,
  ParameterMetadata,
} from "@breadboard-ai/types";
import { classMap } from "lit/directives/class-map.js";
import { OverflowAction } from "../../types/types.js";
import {
  HideTooltipEvent,
  InputEnterEvent,
  OverflowMenuActionEvent,
  OverlayDismissedEvent,
  ParamDeleteEvent,
  ShowTooltipEvent,
  ToastEvent,
  ToastType,
} from "../../events/events.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { GoogleDriveFileId, LLMInput } from "../elements.js";
import {
  isFileDataCapabilityPart,
  isLLMContent,
  ok,
} from "@google-labs/breadboard";
import { InputChangeEvent } from "../../plugins/input-plugin.js";
import { SIGN_IN_CONNECTION_ID } from "../../utils/signin-adapter.js";
import { styleMap } from "lit/directives/style-map.js";
import { map } from "lit/directives/map.js";
import { isA2 } from "@breadboard-ai/a2";

const OVERFLOW_MENU_PADDING = 12;

const DEFAULT_ACTIONS: OverflowAction[] = [
  { icon: "upload", title: "Upload from device", name: "upload" },
  {
    icon: "content-add",
    title: "Create empty content",
    name: "content-add",
  },
  {
    icon: "youtube",
    title: "YouTube",
    name: "youtube",
  },
];

interface GraphParameter {
  path: string;
  metadata: ParameterMetadata;
}

@customElement("bb-asset-organizer")
export class AssetOrganizer extends SignalWatcher(LitElement) {
  @property()
  accessor state: Organizer | null = null;

  @property()
  accessor showAddOverflowMenu = false;
  #addOverflowLocation = {
    x: 0,
    y: 0,
  };

  @property()
  accessor showGDrive = false;

  @state()
  accessor selectedItem: GraphAsset | GraphParameter | null = null;

  @state()
  accessor editAssetTitle: GraphAsset | null = null;

  @property()
  accessor editAssetContent: GraphAsset | null = null;

  @property()
  accessor editParameterContent: GraphParameter | null = null;

  @property()
  accessor showExperimentalComponents = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      position: fixed;
      width: 100%;
      height: 100%;
      left: 0;
      top: 0;
    }

    #background {
      width: 100%;
      height: 100%;
      background: oklch(from var(--bb-neutral-900) l c h / 33%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #add-drive-proxy,
    #add-asset-proxy {
      display: block;
      width: 0;
      height: 0;
      position: absolute;
      pointer-events: none;
      overflow: hidden;
    }

    #container {
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size-2);
      display: flex;
      flex-direction: column;
      overflow: auto;

      width: 80svw;
      height: 70svh;
      max-width: 800px;
      max-height: 600px;

      box-shadow: var(--bb-elevation-5);

      & #add-asset-container {
        height: var(--bb-grid-size-11);
        display: flex;
        align-items: center;
        padding: 0 var(--bb-grid-size-3);
      }

      #edit-parameter,
      #edit-asset,
      #cancel-edit,
      #add-asset {
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        border: none;
        border-radius: var(--bb-grid-size-16);
        height: var(--bb-grid-size-7);
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-7);
        background: var(--bb-neutral-100) var(--bb-icon-add) 6px center / 20px
          20px no-repeat;
        display: flex;
        align-items: center;
        cursor: pointer;
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:hover,
        &:focus {
          background-color: Var(--bb-neutral-300);
        }
      }

      #cancel-edit {
        background-image: var(--bb-icon-eject);
        margin-bottom: var(--bb-grid-size-4);
      }

      #edit-parameter,
      #edit-asset {
        background-image: var(--bb-icon-edit);
        margin-bottom: var(--bb-grid-size-4);

        &.save {
          background-image: var(--bb-icon-save);
        }
      }

      & header {
        display: flex;
        align-items: center;
        height: var(--bb-grid-size-11);
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-4);
        user-select: none;
        border-bottom: 1px solid var(--bb-neutral-300);

        & h1 {
          flex: 1;
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          margin: 0;
          display: flex;
          align-items: center;

          &::before {
            content: "";
            display: block;
            width: 20px;
            height: 20px;
            background: var(--bb-icon-alternate-email) center center / 20px 20px
              no-repeat;
            margin-right: var(--bb-grid-size-2);
          }
        }

        & #toggle-viewer {
          cursor: pointer;
          display: none;
          border-radius: var(--bb-grid-size-16);
          align-items: center;
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          height: var(--bb-grid-size-7);
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
          background: var(--bb-icon-dock-to-right) 8px center / 20px 20px
            no-repeat;
          border: 1px solid transparent;
          margin-right: var(--bb-grid-size);
          transition:
            background-color 0.1s cubic-bezier(0, 0, 0.3, 1),
            border 0.1s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &.active {
            background-color: var(--bb-ui-100);
            border: 1px solid var(--bb-ui-300);
          }
        }

        & #toggle-expanded {
          width: 20px;
          height: 20px;
          flex: 0 0 auto;
          background: var(--bb-icon-expand-content) center center / 20px 20px
            no-repeat;
          border: none;
          font-size: 0;
          cursor: pointer;

          opacity: 0.5;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &:focus {
            opacity: 1;
          }
        }
      }

      & #items {
        flex: 1;
        overflow: auto;

        display: grid;
        grid-template-columns: 232px 1fr;

        bb-multi-output {
          display: block;
        }

        & h3 {
          font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
            var(--bb-font-family);
          text-transform: uppercase;
          color: var(--bb-neutral-500);
          padding: 0 var(--bb-grid-size-3);
          margin: 0;
        }

        & #no-assets,
        & #no-parameters,
        & #no-asset-selected {
          color: var(--bb-neutral-900);
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          padding: var(--bb-grid-size-3) var(--bb-grid-size-3);
        }

        & > section {
          display: flex;
          flex-direction: column;
        }

        & #menu-container {
          flex: 1 0 auto;
          overflow-y: scroll;
          overflow-x: hidden;

          & menu {
            margin: 0;
            padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
            list-style: none;
            width: 100%;
            display: block;

            & li {
              display: flex;
              align-items: center;
              margin-bottom: var(--bb-grid-size);

              & > span {
                display: block;
                width: calc(var(--bb-grid-size-6) + 2px);
                height: var(--bb-grid-size-7);

                &.content {
                  background: var(--bb-neutral-0) var(--bb-icon-text) 4px
                    center / 20px 20px no-repeat;

                  &.youtube {
                    background: var(--bb-neutral-0) var(--bb-icon-youtube) 4px
                      center / 20px 20px no-repeat;
                  }

                  &.gdrive {
                    background: var(--bb-neutral-0)
                      var(--bb-icon-google-drive-outline) 4px center / 20px 20px
                      no-repeat;
                  }
                }

                &.file {
                  background: var(--bb-neutral-0) var(--bb-icon-attach) 4px
                    center / 20px 20px no-repeat;
                }
              }

              & input {
                flex: 1;
                height: var(--bb-grid-size-7);
                line-height: var(--bb-grid-size-7);
                font: 400 var(--bb-body-small) /
                  var(--bb-body-line-height-small) var(--bb-font-family);
                border-radius: var(--bb-grid-size);
                padding: 0 var(--bb-grid-size);
              }

              & .parameter,
              & .asset {
                height: var(--bb-grid-size-7);
                background: var(--bb-ui-100) var(--bb-icon-text) 4px center /
                  20px 20px no-repeat;
                border-radius: var(--bb-grid-size);
                display: block;
                align-items: center;
                font: 400 var(--bb-body-small) /
                  var(--bb-body-line-height-small) var(--bb-font-family);
                border: none;
                padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
                transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
                width: 100%;
                color: var(--bb-neutral-900);
                white-space: nowrap;
                text-overflow: ellipsis;
                overflow: hidden;
                text-align: left;

                &.content {
                  background: var(--bb-ui-100) var(--bb-icon-text) 4px center /
                    20px 20px no-repeat;
                }

                &.youtube {
                  background: var(--bb-ui-100) var(--bb-icon-youtube) 4px
                    center / 20px 20px no-repeat;
                }

                &.gdrive {
                  background: var(--bb-ui-100)
                    var(--bb-icon-google-drive-outline) 4px center / 20px 20px
                    no-repeat;
                }

                &.file {
                  background: var(--bb-ui-100) var(--bb-icon-attach) 4px
                    center / 20px 20px no-repeat;
                }

                &:not(.active) {
                  cursor: pointer;
                  background-color: var(--bb-neutral-0);

                  &:hover,
                  &:focus {
                    background-color: var(--bb-neutral-50);
                  }
                }
              }

              & .parameter {
                background: var(--bb-ui-100) var(--bb-icon-contact-support) 4px
                  center / 20px 20px no-repeat;
              }

              & .delete {
                margin-left: var(--bb-grid-size-2);
                width: 20px;
                height: 20px;
                background: transparent var(--bb-icon-delete) center center /
                  20px 20px no-repeat;
                font-size: 0;
                border: none;
                opacity: 0.5;
                transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

                &:not([disabled]) {
                  cursor: pointer;

                  &:hover,
                  &:focus {
                    opacity: 1;
                  }
                }
              }
            }
          }
        }

        & #details {
          --output-padding-x: var(--bb-grid-size-3);
          --output-padding-y: var(--bb-grid-size-3);

          display: flex;
          border-left: 1px solid var(--bb-neutral-300);

          width: 100%;
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3)
            var(--bb-grid-size-3) var(--bb-grid-size-3);
          overflow-y: scroll;
          overflow-x: hidden;

          &.padded {
            padding-top: var(--bb-grid-size-5);
          }

          bb-multi-output {
            width: 100%;
          }

          & #param-details {
            display: grid;
            padding: 0;

            & label {
              display: flex;
              justify-content: space-between;
              position: relative;
              font: 500 var(--bb-label-small) /
                var(--bb-label-line-height-small) var(--bb-font-family);
              padding-top: var(--bb-grid-size-2);
              margin-bottom: var(--bb-grid-size);
            }

            & textarea,
            & select,
            & input[type="text"],
            & bb-text-editor,
            & div#param-description,
            & div#sample-value {
              display: block;
              width: 100%;
              border-radius: var(--bb-grid-size);
              background: var(--bb-neutral-0);
              color: var(--bb-neutral-900);
              padding: var(--bb-grid-size-2);
              border: 1px solid var(--bb-neutral-300);
              resize: none;
              font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
                var(--bb-font-family);
              margin-bottom: var(--bb-grid-size-2);

              &:focus-within {
                border: 1px solid var(--bb-ui-700);
                outline: 1px solid var(--bb-ui-700);
              }
            }

            & textarea {
              field-sizing: content;
            }

            & div#sample-value {
              line-height: 24px;
            }

            & div#param-description,
            & div#sample-value {
              border: 1px solid var(--bb-neutral-100);
            }

            & bb-text-editor {
              padding: 0;
            }
          }
        }
      }
    }

    bb-overflow-menu {
      position: absolute;
      left: 0;
      top: 0;
      width: 220px;
    }
  `;

  #paramTitleInputRef: Ref<HTMLInputElement> = createRef();
  #paramDescriptionInputRef: Ref<HTMLTextAreaElement> = createRef();
  #paramModalityInputRef: Ref<HTMLTextAreaElement> = createRef();
  #paramSampleValueInputRef: Ref<HTMLTextAreaElement> = createRef();
  #addDriveInputRef: Ref<GoogleDriveFileId> = createRef();
  #uploadInputRef: Ref<HTMLInputElement> = createRef();
  #renameInputRef: Ref<HTMLInputElement> = createRef();
  #contentInputRef: Ref<LLMInput> = createRef();

  #showItem(item: GraphAsset | GraphParameter) {
    this.selectedItem = item;
  }

  #deleting = false;
  async #deleteAsset(asset: AssetPath) {
    if (!this.state) {
      return;
    }

    this.#deleting = true;
    await this.state.removeGraphAsset(asset);
    if (this.selectedItem && this.selectedItem.path === asset) {
      this.selectedItem = null;
    }
    this.#deleting = false;
  }

  #attemptUploadAsset() {
    if (!this.#uploadInputRef.value) {
      return;
    }

    this.#uploadInputRef.value.click();
  }

  async #attemptUpdateAssetTitle(asset: GraphAsset, title: string) {
    const metadata: AssetMetadata = asset.metadata ?? {
      title: title,
      type: "file",
    };

    metadata.title = title;

    await this.state?.changeGraphAssetMetadata(asset.path, metadata);
    this.selectedItem = asset;
  }

  async #attemptCreateEmptyContentAsset() {
    if (!this.state) {
      return;
    }

    const path = globalThis.crypto.randomUUID();
    await this.state.addGraphAsset({
      path,
      metadata: {
        title: "Untitled Content",
        type: "content",
      },
      data: [
        {
          parts: [
            {
              text: "Place your content here",
            },
          ],
          role: "user",
        },
      ],
    });

    const asset = this.state.graphAssets.get(path);
    if (asset) {
      this.selectedItem = asset;
    }
  }

  async #attemptGDrivePickerFlow() {
    if (!this.#addDriveInputRef.value) {
      return;
    }

    try {
      this.#addDriveInputRef.value.triggerFlow();
    } catch (err) {
      this.dispatchEvent(
        new ToastEvent("Unable to load Google Drive", ToastType.ERROR)
      );
    }
  }

  async #attemptCreateFileDataAsset(
    mimeType = "",
    title = "Untitled File Data",
    fileUri = "",
    subType?: string
  ) {
    if (!this.state) {
      return;
    }

    const metadata: AssetMetadata = {
      title,
      type: "content",
    };

    if (subType) {
      metadata.subType = subType;
    }

    const path = globalThis.crypto.randomUUID();
    await this.state.addGraphAsset({
      path,
      metadata,
      data: [
        {
          parts: [
            {
              fileData: {
                fileUri,
                mimeType,
              },
            },
          ],
          role: "user",
        },
      ],
    });

    const asset = this.state.graphAssets.get(path);
    if (asset) {
      this.selectedItem = asset;
    }
  }

  #attemptUpdateAsset() {
    if (!this.#contentInputRef.value || !this.editAssetContent) {
      return;
    }

    if (isLLMContent(this.#contentInputRef.value.value)) {
      this.editAssetContent.data = [this.#contentInputRef.value.value];
    } else {
      console.warn("No LLM Content found");
    }

    this.editAssetContent = null;
  }

  #attemptUpdateParameter() {
    if (
      !this.#paramTitleInputRef.value ||
      !this.#paramDescriptionInputRef.value ||
      !this.#paramSampleValueInputRef.value ||
      !this.#paramModalityInputRef.value ||
      !this.editParameterContent
    ) {
      this.editParameterContent = null;
      return;
    }

    const param = this.state?.parameters.get(this.editParameterContent.path);
    if (param) {
      param.title = this.#paramTitleInputRef.value.value;
      param.description = this.#paramDescriptionInputRef.value.value;
      param.modality = [this.#paramModalityInputRef.value.value];
      param.sample = toLLMContentArray(
        this.#paramSampleValueInputRef.value.value
      );

      this.state?.changeParameterMetadata(
        this.editParameterContent.path,
        param
      );

      // TODO: Add support for sample values.
    }

    this.editParameterContent = null;
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("asset")) {
      this.editAssetContent = null;
    }
  }

  protected updated(): void {
    if (this.editAssetTitle && this.#renameInputRef.value) {
      this.#renameInputRef.value.select();
    }

    if (this.editParameterContent && this.#paramDescriptionInputRef.value) {
      this.#paramDescriptionInputRef.value.select();
    }
  }

  #isGraphAsset(item: unknown): item is GraphAsset {
    return item !== null && "data" in (item as GraphAsset);
  }

  #isGraphParameter(item: unknown): item is GraphParameter {
    return item !== null && !this.#isGraphAsset(item);
  }

  #isAssetMetadata(metadata: unknown): metadata is AssetMetadata {
    return metadata !== null && "subType" in (metadata as AssetMetadata);
  }

  readonly #actions = new Signal.Computed(() => {
    if (!this.state) return DEFAULT_ACTIONS;
    const actions = [
      ...DEFAULT_ACTIONS,
      ...[...this.state.connectors.types.values()]
        .filter(
          (connector) =>
            !connector.url.includes("/_") &&
            (!connector.experimental || this.showExperimentalComponents) &&
            isA2(connector.url) &&
            (!connector.singleton ||
              !this.state?.connectors.instanceExists(connector.url))
        )
        .map((connector) => {
          return {
            title: connector.title,
            name: "connector",
            icon: connector.icon || "content-add",
            value: connector.url,
          };
        }),
    ];

    if (this.showGDrive) {
      actions.push({
        icon: "gdrive",
        title: "Google Drive",
        name: "gdrive",
      });
    }

    return actions;
  });

  render() {
    const assets = this.state?.graphAssets;
    const parameters = this.state?.parameters;

    const itemData = this.#isGraphAsset(this.selectedItem)
      ? (this.selectedItem.data.at(-1) ?? null)
      : null;

    const isParameter = this.#isGraphParameter(this.selectedItem);

    const isFileData = this.#isGraphAsset(this.selectedItem)
      ? this.selectedItem.data.some((content) =>
          content.parts.some((part) => isFileDataCapabilityPart(part))
        )
      : false;
    const hasEditableParts = !isFileData;
    const supportedExportControls = { drive: false, clipboard: false };

    if (this.selectedItem) {
      const type = this.#isAssetMetadata(this.selectedItem.metadata)
        ? this.selectedItem.metadata?.type
        : undefined;
      const subType = this.#isAssetMetadata(this.selectedItem.metadata)
        ? this.selectedItem.metadata?.subType
        : undefined;
      supportedExportControls.clipboard = subType !== "gdrive";
      supportedExportControls.drive =
        type === "content" && subType !== "gdrive" && subType !== "youtube";
    }

    let addOverflowMenu: TemplateResult | symbol = nothing;
    if (this.showAddOverflowMenu) {
      addOverflowMenu = html`<bb-overflow-menu
        .actions=${this.#actions}
        .disabled=${false}
        style=${styleMap({
          left: `${this.#addOverflowLocation.x}px`,
          top: `${this.#addOverflowLocation.y}px`,
        })}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
        @bboverflowmenuaction=${async (evt: OverflowMenuActionEvent) => {
          evt.stopImmediatePropagation();

          switch (evt.action) {
            case "upload": {
              this.#attemptUploadAsset();
              break;
            }

            case "content-add": {
              await this.#attemptCreateEmptyContentAsset();
              break;
            }

            case "gdrive": {
              await this.#attemptGDrivePickerFlow();
              break;
            }

            case "youtube": {
              await this.#attemptCreateFileDataAsset(
                "video/mp4",
                "YouTube Video",
                "",
                "youtube"
              );
              break;
            }

            case "connector": {
              const creatingConnector =
                await this.state?.connectors.initializeInstance(evt.value);
              if (!ok(creatingConnector)) {
                console.log(
                  `Unable to create connector: ${creatingConnector.$error}`
                );
                this.dispatchEvent(
                  new ToastEvent("Unable to create connector", ToastType.ERROR)
                );
              }
              break;
            }
          }

          this.showAddOverflowMenu = false;
        }}
        @bboverflowmenudismissed=${() => {
          this.showAddOverflowMenu = false;
        }}
      ></bb-overflow-menu>`;
    }

    const assetType = this.#isGraphAsset(this.selectedItem)
      ? this.selectedItem.metadata?.type
      : undefined;

    return html` <div
        id="background"
        @pointerdown=${() => {
          this.dispatchEvent(new OverlayDismissedEvent());
        }}
      >
        <div
          id="container"
          @pointerdown=${(evt: PointerEvent) => {
            evt.stopImmediatePropagation();

            this.showAddOverflowMenu = false;
          }}
        >
          <header>
            <h1>${Strings.from("LABEL_TITLE")}</h1>
          </header>
          <section id="items">
            <section>
              <div id="add-asset-container">
                <button
                  id="add-asset"
                  @click=${(evt: PointerEvent) => {
                    this.showAddOverflowMenu = true;

                    if (!(evt.target instanceof HTMLButtonElement)) {
                      return;
                    }

                    const bounds = evt.target.getBoundingClientRect();
                    this.#addOverflowLocation = {
                      x: bounds.left,
                      y: bounds.bottom + OVERFLOW_MENU_PADDING,
                    };
                  }}
                >
                  ${Strings.from("COMMAND_ADD_ASSET")}
                </button>
              </div>
              <div id="menu-container">
                <h3>Assets</h3>
                ${assets && assets.size > 0
                  ? html`<menu>
                      ${map(assets, ([path, asset]) => {
                        if (path === "@@splash") {
                          return nothing;
                        }

                        return html`<li>
                          ${asset === this.editAssetTitle
                            ? html`<span
                                  class=${classMap({
                                    [asset.metadata?.type ?? "generic"]: true,
                                    [asset.metadata?.subType ?? "sub-generic"]:
                                      true,
                                  })}
                                ></span>

                                <input
                                  type="text"
                                  required
                                  autofocus
                                  .value=${asset.metadata?.title || path}
                                  ${ref(this.#renameInputRef)}
                                  @blur=${(evt: Event) => {
                                    if (
                                      !(evt.target instanceof HTMLInputElement)
                                    ) {
                                      return;
                                    }

                                    if (!this.editAssetTitle) {
                                      return;
                                    }

                                    if (!evt.target.value) {
                                      evt.target.reportValidity();
                                      return;
                                    }

                                    this.#attemptUpdateAssetTitle(
                                      this.editAssetTitle,
                                      evt.target.value
                                    );
                                    this.#showItem(this.editAssetTitle);
                                    this.editAssetTitle = null;
                                  }}
                                  @keydown=${(evt: KeyboardEvent) => {
                                    if (
                                      !(evt.target instanceof HTMLInputElement)
                                    ) {
                                      return;
                                    }

                                    if (evt.key !== "Enter") {
                                      return;
                                    }

                                    if (!this.editAssetTitle) {
                                      return;
                                    }

                                    if (!evt.target.value) {
                                      evt.target.reportValidity();
                                      return;
                                    }

                                    this.#attemptUpdateAssetTitle(
                                      this.editAssetTitle,
                                      evt.target.value
                                    );
                                    this.#showItem(this.editAssetTitle);
                                    this.editAssetTitle = null;
                                  }}
                                />`
                            : html`<button
                                class=${classMap({
                                  asset: true,
                                  [asset.metadata?.type ?? "generic"]: true,
                                  [asset.metadata?.subType ?? "sub-generic"]:
                                    true,
                                  active:
                                    asset.path === this.selectedItem?.path,
                                })}
                                @click=${() => {
                                  if (asset !== this.selectedItem) {
                                    this.#showItem(asset);
                                  } else {
                                    this.editAssetTitle = asset;
                                  }
                                }}
                                @dblclick=${() => {
                                  this.editAssetTitle = asset;
                                }}
                              >
                                ${asset.metadata?.title || path}
                              </button>`}

                          <button
                            class=${classMap({
                              delete: true,
                            })}
                            @pointerover=${(evt: PointerEvent) => {
                              this.dispatchEvent(
                                new ShowTooltipEvent(
                                  Strings.from("LABEL_DELETE_ASSET"),
                                  evt.clientX,
                                  evt.clientY
                                )
                              );
                            }}
                            @pointerout=${() => {
                              this.dispatchEvent(new HideTooltipEvent());
                            }}
                            @click=${async () => {
                              if (this.#deleting) {
                                return;
                              }

                              this.dispatchEvent(new HideTooltipEvent());
                              await this.#deleteAsset(path);
                            }}
                          >
                            Delete
                          </button>
                        </li>`;
                      })}
                    </menu>`
                  : html`<div id="no-assets">
                      ${Strings.from("LABEL_NO_ASSETS")}
                    </div>`}

                <h3>Parameters</h3>
                ${parameters && parameters.size > 0
                  ? html`<menu>
                      ${map(parameters, ([path, parameter]) => {
                        if (path === "@@splash") {
                          return nothing;
                        }

                        return html`<li>
                          <button
                            class=${classMap({
                              parameter: true,
                              active: path === this.selectedItem?.path,
                            })}
                            @click=${() => {
                              if (path !== this.selectedItem?.path) {
                                this.#showItem({ path, metadata: parameter });
                              }
                            }}
                          >
                            ${parameter.title ?? path}
                          </button>

                          <button
                            ?disabled=${parameter.usedIn.length > 0}
                            class=${classMap({
                              delete: true,
                            })}
                            @pointerover=${(evt: PointerEvent) => {
                              const message = parameter.usedIn.length
                                ? "LABEL_DELETE_PARAM_UNAVAILABLE"
                                : "LABEL_DELETE_PARAM";
                              this.dispatchEvent(
                                new ShowTooltipEvent(
                                  Strings.from(message),
                                  evt.clientX,
                                  evt.clientY
                                )
                              );
                            }}
                            @pointerout=${() => {
                              this.dispatchEvent(new HideTooltipEvent());
                            }}
                            @click=${async () => {
                              this.dispatchEvent(new HideTooltipEvent());

                              // TODO: Figure out how we handle params for subgraphs.
                              this.dispatchEvent(
                                new ParamDeleteEvent("", path)
                              );
                            }}
                          >
                            Delete
                          </button>
                        </li>`;
                      })}
                    </menu>`
                  : html`<div id="no-parameters">
                      ${Strings.from("LABEL_NO_PARAMETERS")}
                    </div>`}
              </div>
            </section>

            <section
              id="details"
              class=${classMap({
                padded: assetType === "file",
              })}
            >
              ${itemData
                ? html`
                    ${assetType === "content" || assetType === "connector"
                      ? html`<div>
                          <button
                            id="edit-asset"
                            class=${classMap({
                              save: this.editAssetContent !== null,
                            })}
                            @click=${() => {
                              if (!this.selectedItem) {
                                return;
                              }

                              if (!this.editAssetContent) {
                                if (!this.#isGraphAsset(this.selectedItem)) {
                                  return;
                                }
                                this.editAssetContent = this.selectedItem;
                                return;
                              }

                              if (!this.#contentInputRef.value) {
                                console.warn("No LLM Content editor");
                                return;
                              }

                              if (assetType === "connector") {
                                const path = this.selectedItem?.path;
                                if (!path) return;

                                this.state?.graphAssets
                                  .get(path)
                                  ?.connector?.commitEdits(
                                    undefined,
                                    this.#contentInputRef.value.value as Record<
                                      string,
                                      JsonSerializable
                                    >
                                  )
                                  .then((result) => {
                                    this.editAssetContent = null;
                                    if (!ok(result)) {
                                      console.warn(
                                        `Unable to update connector: ${result.$error}`
                                      );
                                      this.dispatchEvent(
                                        new ToastEvent(
                                          "Unable to update connector",
                                          ToastType.ERROR
                                        )
                                      );
                                    }
                                  });
                              } else {
                                this.#attemptUpdateAsset();
                              }
                            }}
                          >
                            ${this.editAssetContent
                              ? Strings.from("COMMAND_SAVE_ASSET")
                              : Strings.from("COMMAND_EDIT_ASSET")}
                          </button>
                          ${this.editAssetContent
                            ? html`<button
                                id="cancel-edit"
                                @click=${() => {
                                  this.state?.connectors.cancel();
                                  this.editAssetContent = null;
                                }}
                              >
                                ${Strings.from("COMMAND_CANCEL")}
                              </button>`
                            : nothing}
                        </div>`
                      : nothing}
                    ${this.editAssetContent
                      ? assetType === "connector"
                        ? html`<bb-edit-connector
                            ${ref(this.#contentInputRef)}
                            @bbinputenter=${(evt: InputEnterEvent) => {
                              evt.stopImmediatePropagation();

                              const path = this.selectedItem?.path;
                              if (!path) return;

                              this.state?.graphAssets
                                .get(path)
                                ?.connector?.commitEdits(
                                  undefined,
                                  evt.data as Record<string, JsonSerializable>
                                )
                                .then((result) => {
                                  this.editAssetContent = null;
                                  if (!ok(result)) {
                                    console.warn(
                                      `Unable to update connector: ${result.$error}`
                                    );
                                    this.dispatchEvent(
                                      new ToastEvent(
                                        "Unable to update connector",
                                        ToastType.ERROR
                                      )
                                    );
                                  }
                                });
                            }}
                            .state=${this.state}
                            .path=${this.editAssetContent.path}
                          ></bb-edit-connector>`
                        : html`<bb-llm-input
                            ${ref(this.#contentInputRef)}
                            @keydown=${(evt: KeyboardEvent) => {
                              const isMac =
                                navigator.platform.indexOf("Mac") === 0;
                              const isCtrlCommand = isMac
                                ? evt.metaKey
                                : evt.ctrlKey;

                              if (evt.key === "Enter" && isCtrlCommand) {
                                this.#attemptUpdateAsset();
                              }
                            }}
                            .value=${itemData}
                            .clamped=${false}
                            .description=${null}
                            .showInlineControlsToggle=${hasEditableParts}
                            .showInlineControls=${hasEditableParts}
                            .showPartControls=${hasEditableParts}
                            .autofocus=${true}
                          ></bb-llm-input>`
                      : assetType === "connector"
                        ? html`<bb-view-connector
                            .state=${this.state}
                            .path=${this.selectedItem?.path}
                          ></bb-view-connector>`
                        : html`<bb-llm-output
                            .value=${itemData}
                            .clamped=${false}
                            .graphUrl=${this.state?.graphUrl || null}
                            .showExportControls=${true}
                            .supportedExportControls=${supportedExportControls}
                          ></bb-llm-output>`}
                  `
                : isParameter
                  ? html` <div>
                        <button
                          id="edit-parameter"
                          class=${classMap({
                            save: this.editParameterContent !== null,
                          })}
                          @click=${() => {
                            if (!this.selectedItem) {
                              return;
                            }

                            if (!this.editParameterContent) {
                              if (!this.#isGraphParameter(this.selectedItem)) {
                                return;
                              }
                              this.editParameterContent = this.selectedItem;
                              return;
                            }

                            this.#attemptUpdateParameter();
                          }}
                        >
                          ${this.editParameterContent
                            ? Strings.from("COMMAND_SAVE_PARAMETER")
                            : Strings.from("COMMAND_EDIT_PARAMETER")}
                        </button>
                      </div>

                      <div
                        id="param-details"
                        @keydown=${(evt: KeyboardEvent) => {
                          const isMac = navigator.platform.indexOf("Mac") === 0;
                          const isCtrlCommand = isMac
                            ? evt.metaKey
                            : evt.ctrlKey;

                          if (evt.key === "Enter" && isCtrlCommand) {
                            this.#attemptUpdateParameter();
                          }
                        }}
                      >
                        ${this.editParameterContent
                          ? html`
                              <label for="param-title">Title</label>
                              <input
                                type="text"
                                ${ref(this.#paramTitleInputRef)}
                                id="param-title"
                                .value=${this.selectedItem?.metadata?.title ??
                                ""}
                                placeholder=${Strings.from("LABEL_ENTER_TITLE")}
                              />

                              <label for="param-description">Description</label>
                              <textarea
                                ${ref(this.#paramDescriptionInputRef)}
                                id="param-description"
                                .value=${this.selectedItem?.metadata
                                  ?.description ?? ""}
                                placeholder=${Strings.from(
                                  "LABEL_ENTER_DESCRIPTION"
                                )}
                              ></textarea>

                              <label for="modality">Type</label>
                              <input
                                type="text"
                                disabled
                                id="modality"
                                ${ref(this.#paramModalityInputRef)}
                                .value=${"text"}
                                placeholder=${Strings.from(
                                  "LABEL_ENTER_MODALITY"
                                )}
                              />

                              <label for="sample-value">Sample Value</label>
                              <textarea
                                id="sample-value"
                                ${ref(this.#paramSampleValueInputRef)}
                                .value=${""}
                                placeholder=${Strings.from(
                                  "LABEL_ENTER_SAMPLE"
                                )}
                              ></textarea>
                            `
                          : html`
                              <label for="param-description">Description</label>
                              <div id="param-description">
                                ${this.selectedItem?.metadata?.description ||
                                "No description"}
                              </div>

                              <label for="sample-value">Sample Value</label>
                              <div id="sample-value">${"No sample value"}</div>
                            `}
                      </div>`
                  : html`<div id="no-asset-selected">No item selected</div>`}
            </section>
          </section>
        </div>

        <div>
          <bb-google-drive-file-id
            id="add-drive-proxy"
            ${ref(this.#addDriveInputRef)}
            .connectionName=${SIGN_IN_CONNECTION_ID}
            @bb-input-change=${(evt: InputChangeEvent) => {
              const driveFile = evt.value as {
                preview: string;
                id: string;
                mimeType: string;
              };

              this.#attemptCreateFileDataAsset(
                driveFile.mimeType,
                driveFile.preview,
                driveFile.id,
                "gdrive"
              );
            }}
          ></bb-google-drive-file-id>
        </div>
      </div>

      <input
        type="file"
        id="add-asset-proxy"
        multiple
        ${ref(this.#uploadInputRef)}
        @change=${(evt: InputEvent) => {
          if (!(evt.target instanceof HTMLInputElement) || !evt.target.files) {
            return;
          }

          const target = evt.target;
          const assetLoad = [...evt.target.files].map((file) => {
            return new Promise<{
              name: string;
              type: string;
              content: string | null;
            }>((resolve) => {
              const reader = new FileReader();
              reader.addEventListener("loadend", () => {
                resolve({
                  name: file.name,
                  type: file.type,
                  content: reader.result as string | null,
                });
              });
              reader.readAsDataURL(file);
            });
          });

          Promise.all(assetLoad).then((assets) => {
            // Reset the input otherwise we aren't guaranteed to get the
            // input event if the same files are uploaded.
            target.value = "";

            if (!this.state) {
              return;
            }

            for (const asset of assets) {
              if (!asset.content) continue;
              const [, mimeType, , data] = asset.content.split(/[:;,]/);
              this.state.addGraphAsset({
                path: asset.name,
                metadata: {
                  title: asset.name,
                  type: "file",
                },
                data: [
                  {
                    parts: [
                      {
                        inlineData: { mimeType, data },
                      },
                    ],
                    role: "user",
                  },
                ],
              });
            }
          });
        }}
      />
      ${addOverflowMenu}`;
  }
}

function toLLMContentArray(text: string): NodeValue {
  const c: LLMContent[] = [
    {
      parts: [{ text }],
    },
  ];
  return c as NodeValue;
}
