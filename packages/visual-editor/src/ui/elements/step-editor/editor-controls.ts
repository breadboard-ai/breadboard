/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Editor");

import {
  EditHistory,
  GraphStoreEntry,
  InspectableGraph,
  MainGraphIdentifier,
} from "@breadboard-ai/types";
import {
  parseBase64DataUrl,
  NOTEBOOKLM_MIMETYPE,
  toNotebookLmUrl,
} from "@breadboard-ai/utils";
import { consume } from "@lit/context";
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { notebookLmIcon } from "../../styles/svg-icons.js";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { A2_COMPONENTS } from "../../../a2/a2-registry.js";

import {
  HideTooltipEvent,
  ShowTooltipEvent,
  StateEvent,
  ToastEvent,
  ZoomInEvent,
  ZoomOutEvent,
  ZoomToFitEvent,
} from "../../events/events.js";
import { ToastType } from "../../../sca/types.js";
import { InputChangeEvent } from "../../plugins/input-plugin.js";
import { icons } from "../../styles/icons.js";
import { NewAsset } from "../../types/types.js";
import { iconSubstitute } from "../../utils/icon-substitute.js";
import { GoogleDriveFileId, ItemSelect } from "../elements.js";
import type { PickedValue } from "../google-drive/google-drive-file-id.js";
import type { NotebookPickedValue } from "../notebooklm-picker/notebooklm-picker.js";
import { DATA_TYPE } from "./constants.js";
import { CreateNewAssetsEvent, NodeAddEvent } from "./events/events.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import "../../elements/graph-editing-chat/graph-editing-chat.js";

@customElement("bb-editor-controls")
export class EditorControls extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  @property({ reflect: true, type: Boolean })
  accessor readOnly = false;

  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @property()
  accessor showExperimentalComponents = false;

  @state()
  accessor history: EditHistory | null = null;

  @state()
  accessor showComponentPicker = false;
  #componentPickerConfiguration: {
    components: Array<{ id: string; metadata: GraphStoreEntry }>;
    x: number;
    y: number;
  } = {
    components: [],
    x: 0,
    y: 0,
  };

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        align-items: center;
        justify-content: center;
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        pointer-events: none;
      }

      :host > * {
        pointer-events: auto;
      }

      :host([readonly]) {
        #top-shelf,
        bb-flowgen-editor-input,
        bb-graph-editing-chat {
          display: none;
        }
      }

      #graph-controls {
        position: absolute;
        display: flex;
        flex-direction: column;
        right: var(--bb-grid-size-6);
        bottom: var(--bb-grid-size-7);
        background: light-dark(var(--n-100), var(--n-20));
        border-radius: var(--bb-grid-size-16);
        padding: var(--bb-grid-size) var(--bb-grid-size);
        box-shadow: light-dark(var(--bb-elevation-16-light), none);

        &::before {
          content: "";
          position: absolute;
          width: calc(100% - 2px);
          height: 1px;
          left: 1px;
          top: 113.5px;
          background: light-dark(var(--n-90), var(--n-30));
        }

        & button {
          color: light-dark(var(--n-0), var(--n-80));
          background: light-dark(var(--n-100), var(--n-20)) center center / 20px
            20px no-repeat;
          width: var(--bb-grid-size-7);
          height: var(--bb-grid-size-7);
          padding: 0;
          border: none;
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
          border-radius: var(--bb-grid-size);
          display: flex;
          align-items: center;
          justify-content: center;

          & .g-icon {
            pointer-events: none;
          }

          &#zoom-to-fit {
            height: var(--bb-grid-size-10);
            margin-bottom: var(--bb-grid-size);
            border-radius: var(--bb-grid-size-12) var(--bb-grid-size-12)
              var(--bb-grid-size) var(--bb-grid-size);
          }

          &#zoom-in,
          &#zoom-out,
          &#undo {
            margin-top: var(--bb-grid-size);
          }

          &#redo {
            border-radius: var(--bb-grid-size) var(--bb-grid-size)
              var(--bb-grid-size-12) var(--bb-grid-size-12);
            margin: var(--bb-grid-size) 0 var(--bb-grid-size-2) 0;
          }

          &[disabled] {
            opacity: 0.38;
          }

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              background-color: light-dark(var(--n-98), var(--n-30));
            }
          }
        }
      }

      #top-shelf {
        position: absolute;
        display: flex;
        left: 50%;
        translate: -50% 0;
        top: var(--bb-grid-size-5);

        & .loading {
          padding: 0 var(--bb-grid-size-4);
          display: flex;
          align-items: center;

          &::before {
            content: "";
            display: block;
            width: 20px;
            height: 20px;
            margin-right: var(--bb-grid-size-2);
            background: url(/images/progress-ui.svg) center center / 20px 20px
              no-repeat;
          }
        }

        & #items {
          display: flex;
          align-items: center;

          border-radius: var(--bb-grid-size-16);
          height: var(--bb-grid-size-10);
          background: light-dark(var(--n-100), var(--n-20));
          padding: 0;

          & bb-item-select {
            position: relative;
            margin: 0 2px;

            --menu-width: 200px;
            --selected-item-column-gap: var(--bb-grid-size);
            --selected-item-height: var(--bb-grid-size-9);
            --selected-item-hover-color: light-dark(var(--n-98), var(--n-20));
            --selected-item-border-radius: var(--bb-grid-size-2)
              var(--bb-grid-size-16) var(--bb-grid-size-16)
              var(--bb-grid-size-2);
            --selected-item-font: 400 var(--bb-label-large) /
              var(--bb-label-line-height-large) var(--bb-font-family);
            --selected-item-title-padding: 0 var(--bb-grid-size-2) 0 0;

            &::before {
              content: "";
              height: calc(100% + -8px);
              position: absolute;
              top: 4px;
              left: -3px;
              translate: -0.5px 0;
              border-left: 1px solid light-dark(var(--n-90), var(--n-30));
            }
          }

          & button {
            display: flex;
            align-items: center;
            color: light-dark(var(--n-0), var(--n-90));
            margin-right: var(--bb-grid-size);
            background: light-dark(var(--n-100), var(--n-20));
            transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:first-of-type {
              border-radius: var(--bb-grid-size-16) var(--bb-grid-size-2)
                var(--bb-grid-size-2) var(--bb-grid-size-16);
              margin-left: 2px;
              padding-left: var(--bb-grid-size-4);
            }

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
              color: light-dark(var(--n-0), var(--n-80));
            }

            &:hover,
            &:focus {
              background: light-dark(var(--n-98), var(--n-30));
            }
          }
        }

        & button {
          display: flex;
          align-items: center;
          height: var(--bb-grid-size-9);
          border: none;
          border-radius: var(--bb-grid-size);
          padding: 0 var(--bb-grid-size-2);
          position: relative;
          opacity: 0.3;
          background: var(--light-dark-n-100);
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
          white-space: nowrap;

          &:not([disabled]) {
            cursor: pointer;
            opacity: 1;

            &:focus,
            &:hover {
              opacity: 1;
            }
          }
        }
      }

      #shelf {
        position: absolute;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        box-sizing: border-box;
      }

      bb-flowgen-editor-input {
        flex: 1;
        margin: var(--bb-grid-size-7) var(--bb-grid-size-3);
      }

      #component-picker {
        position: fixed;
        left: var(--component-picker-x, 100px);
        bottom: var(--component-picker-y, 100px);
        z-index: 5;
        background: var(--light-dark-n-100);
        border: 1px solid var(--light-dark-n-90);
        width: 172px;
        border-radius: var(--bb-grid-size-2);
        box-shadow: var(--bb-elevation-5);
        animation: slideIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

        .no-components-available {
          padding: var(--bb-grid-size-2) var(--bb-grid-size-3);

          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
        }

        ul#components {
          margin: 0;
          padding: 0;
          list-style: none;

          & li {
            display: grid;
            grid-template-columns: 20px 1fr;
            column-gap: var(--bb-grid-size-2);
            padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
            cursor: pointer;
            position: relative;

            &::before {
              content: "";
              position: absolute;
              display: block;
              left: 2px;
              top: 2px;
              width: calc(100% - 4px);
              height: calc(100% - 4px);
              background: var(--light-dark-n-98);
              z-index: 0;
              border-radius: var(--bb-grid-size);
              opacity: 0;
              transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);
            }

            &:hover::before {
              opacity: 1;
            }

            & .node-id {
              position: relative;
              color: var(--light-dark-n-10);
              margin-bottom: var(--bb-grid-size);
              font: 400 var(--bb-body-medium) /
                var(--bb-body-line-height-medium) var(--bb-font-family);
            }

            & .node-icon {
              position: relative;
              width: 20px;
              height: 20px;
              border-radius: 4px;
              background: transparent var(--bb-icon-board) top left / 20px 20px
                no-repeat;

              &.code-blocks {
                background: var(--bb-icon-code-blocks) top left / 20px 20px
                  no-repeat;
              }

              &.comment {
                background: var(--bb-icon-comment) top left / 20px 20px
                  no-repeat;
              }

              &.input {
                background: var(--bb-icon-input) top left / 20px 20px no-repeat;
              }

              &.search {
                background: var(--bb-icon-search) top left / 20px 20px no-repeat;
              }

              &.public {
                background: var(--bb-icon-public) top left / 20px 20px no-repeat;
              }

              &.globe-book {
                background: var(--bb-icon-globe-book) top left / 20px 20px
                  no-repeat;
              }

              &.language {
                background: var(--bb-icon-language) top left / 20px 20px
                  no-repeat;
              }

              &.map-search {
                background: var(--bb-icon-map-search) top left / 20px 20px
                  no-repeat;
              }

              &.sunny {
                background: var(--bb-icon-sunny) top left / 20px 20px no-repeat;
              }

              &.tool {
                background: var(--bb-icon-home-repair-service) top left / 20px
                  20px no-repeat;
              }

              &.combine-outputs {
                background: var(--bb-icon-table-rows) top left / 20px 20px
                  no-repeat;
              }

              &.smart-toy {
                background: var(--bb-icon-smart-toy) top left / 20px 20px
                  no-repeat;
              }

              &.human {
                background: var(--bb-icon-human) top left / 20px 20px no-repeat;
              }

              &.merge-type {
                background: var(--bb-icon-merge-type) top left / 20px 20px
                  no-repeat;
              }

              &.laps {
                background: var(--bb-icon-laps) top left / 20px 20px no-repeat;
              }

              &.google-drive {
                background: var(--bb-icon-google-drive) top left / 20px 20px
                  no-repeat;
              }

              &.generative {
                background: var(--bb-add-icon-generative) top left / 20px 20px
                  no-repeat;
              }

              &.generative-audio {
                background: var(--bb-add-icon-generative-audio) top left / 20px
                  20px no-repeat;
              }

              &.generative-code {
                background: var(--bb-add-icon-generative-code) top left / 20px
                  20px no-repeat;
              }

              &.generative-text {
                background: var(--bb-add-icon-generative-text) top left / 20px
                  20px no-repeat;
              }

              &.generative-image {
                background: var(--bb-add-icon-generative-image) top left / 20px
                  20px no-repeat;
              }

              &.generative-image-edit {
                background: var(--bb-add-icon-generative-image-edit-auto) top
                  left / 20px 20px no-repeat;
              }

              &.generative-video {
                background: var(--bb-add-icon-generative-videocam-auto) top
                  left / 20px 20px no-repeat;
              }

              &.generative-search {
                background: var(--bb-add-icon-generative-search) top left / 20px
                  20px no-repeat;
              }
            }
          }

          & li.separator {
            border-top: 1px solid var(--light-dark-n-90);
          }
        }
      }

      #add-drive-proxy {
        display: block;
        width: 0;
        height: 0;
        position: absolute;
        pointer-events: none;
        overflow: hidden;
      }
    `,
  ];

  #addDriveInputRef: Ref<GoogleDriveFileId> = createRef();

  hidePickers() {
    this.showComponentPicker = false;
  }

  #attemptGDrivePickerFlow() {
    if (!this.#addDriveInputRef.value) {
      return;
    }

    try {
      this.#addDriveInputRef.value.triggerFlow();
    } catch (err) {
      console.warn(err);
      this.dispatchEvent(
        new ToastEvent("Unable to load Google Drive", ToastType.ERROR)
      );
    }
  }

  #attemptNotebookLMPickerFlow() {
    this.sca.actions.notebookLmPicker.open(
      (notebooks: NotebookPickedValue[]) => {
        const assets = notebooks.map((notebook) => ({
          path: globalThis.crypto.randomUUID(),
          name: notebook.preview,
          type: "content" as const,
          subType: "notebooklm" as const,
          managed: false,
          data: {
            role: "user" as const,
            parts: [
              {
                storedData: {
                  handle: toNotebookLmUrl(notebook.id),
                  mimeType: NOTEBOOKLM_MIMETYPE,
                },
              },
            ],
          },
        }));
        this.dispatchEvent(new CreateNewAssetsEvent(assets));
      }
    );
  }
  #handleChosenKitItem(nodeType: string) {
    let x;
    let y;
    let subGraphId;
    const createAtCenter = true;
    this.dispatchEvent(
      new NodeAddEvent(nodeType, createAtCenter, x, y, subGraphId)
    );
    this.hidePickers();
  }

  render() {
    if (!this.graph) {
      return nothing;
    }

    const items: HTMLTemplateResult[] = A2_COMPONENTS.map((item) => {
      const classes: Record<string, boolean> = {
        "sans-flex": true,
        "w-500": true,
        "md-body-small": true,
        round: true,
      };
      if (item.icon) {
        classes[item.icon] = true;
      }

      return html`<button
        draggable="true"
        class=${classMap(classes)}
        @click=${() => {
          this.sca?.services.actionTracker?.addNewStep(item.title);
          this.#handleChosenKitItem(item.url);
        }}
        @dragstart=${(evt: DragEvent) => {
          this.sca?.services.actionTracker?.addNewStep(item.title);
          if (!evt.dataTransfer) {
            return;
          }

          evt.dataTransfer.setData(DATA_TYPE, item.url);
        }}
      >
        ${item.icon
          ? html`<span class="g-icon filled round"
              >${iconSubstitute(item.icon)}</span
            >`
          : nothing}
        ${item.title}
      </button>`;
    });

    items.push(
      html`<bb-item-select
          .heading=${Strings.from("LABEL_ADD_ASSETS")}
          .showDownArrow=${false}
          @change=${(evt: Event) => {
            const [select] = evt.composedPath();
            if (!(select instanceof ItemSelect)) {
              return;
            }

            switch (select.value) {
              case "text": {
                this.dispatchEvent(
                  new CreateNewAssetsEvent([
                    {
                      path: globalThis.crypto.randomUUID(),
                      type: "content",
                      name: "Text",
                      data: {
                        role: "user",
                        parts: [{ text: "" }],
                      },
                    },
                  ])
                );
                break;
              }

              case "drawing": {
                this.dispatchEvent(
                  new CreateNewAssetsEvent([
                    {
                      path: globalThis.crypto.randomUUID(),
                      type: "content",
                      subType: "drawable",
                      name: "Drawing",
                      data: {
                        role: "user",
                        parts: [
                          { inlineData: { mimeType: "image/png", data: "" } },
                        ],
                      },
                    },
                  ])
                );
                break;
              }

              case "upload": {
                const f = document.createElement("input");
                f.type = "file";
                f.multiple = true;
                f.addEventListener("change", () => {
                  if (!f.files) {
                    return;
                  }

                  Promise.all(
                    [...f.files].map((file) => {
                      return new Promise<{
                        name: string;
                        mimeType: string;
                        data: string;
                      }>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          // In some cases, file.type is an empty string,
                          // like when the OS doesn't recognize the file
                          // extension.
                          const part = parseBase64DataUrl(
                            reader.result as string
                          );
                          if (!part) {
                            reject(`Unable to read the files`);
                            return;
                          }
                          // One of those types is Markdown, so we just look
                          // at the extension here and flip the MIME type.
                          if (file.name.endsWith(".md")) {
                            part.inlineData.mimeType = "text/plain";
                          }
                          resolve({
                            name: file.name,
                            mimeType: part.inlineData.mimeType,
                            data: part.inlineData.data,
                          });
                        };
                        reader.onerror = () => reject("File read error");
                        reader.readAsDataURL(file);
                      });
                    })
                  ).then((files) => {
                    const assets: NewAsset[] = files.map((file) => {
                      return {
                        path: globalThis.crypto.randomUUID(),
                        type: "file",
                        name: file.name,
                        managed: true,
                        data: {
                          role: "user",
                          parts: [
                            {
                              inlineData: {
                                mimeType: file.mimeType,
                                data: file.data,
                              },
                            },
                          ],
                        },
                      };
                    });

                    this.dispatchEvent(new CreateNewAssetsEvent(assets));
                  });
                });

                f.click();
                break;
              }

              case "youtube": {
                this.dispatchEvent(
                  new CreateNewAssetsEvent([
                    {
                      path: globalThis.crypto.randomUUID(),
                      name: "YouTube Video",
                      type: "content",
                      subType: "youtube",
                      data: {
                        role: "user",
                        parts: [
                          {
                            fileData: { fileUri: "", mimeType: "video/mp4" },
                          },
                        ],
                      },
                    },
                  ])
                );
                break;
              }

              case "gdrive": {
                this.#attemptGDrivePickerFlow();
                break;
              }

              case "notebooklm": {
                this.#attemptNotebookLMPickerFlow();
                break;
              }

              default: {
                console.log("Init", select.value);
                break;
              }
            }
          }}
          .freezeValue=${0}
          .transparent=${true}
          .values=${[
            {
              id: "asset",
              title: "Add Assets",
              icon: "add_box",
              hidden: true,
            },
            {
              id: "upload",
              title: "Upload file",
              icon: "upload",
            },
            {
              id: "gdrive",
              title: "My Drive",
              icon: "drive",
            },
            ...(this.sca.env.flags.get("enableNotebookLm")
              ? [
                  {
                    id: "notebooklm",
                    title: "NotebookLM",
                    icon: notebookLmIcon,
                  },
                ]
              : []),
            {
              id: "youtube",
              title: "YouTube",
              icon: "video_youtube",
            },
            {
              id: "text",
              title: "Text",
              icon: "text_fields",
            },
            {
              id: "drawing",
              title: "Drawing",
              icon: "draw",
            },
          ]}
        ></bb-item-select>
        <div>
          <bb-google-drive-file-id
            id="add-drive-proxy"
            ${ref(this.#addDriveInputRef)}
            @bb-input-change=${(evt: InputChangeEvent) => {
              const driveFile = evt.value as PickedValue;

              this.dispatchEvent(
                new CreateNewAssetsEvent([
                  {
                    path: globalThis.crypto.randomUUID(),
                    name: driveFile.preview,
                    type: "content",
                    subType: "gdrive",
                    managed: false,
                    data: {
                      role: "user",
                      parts: [
                        {
                          storedData: {
                            handle: `drive:/${driveFile.id}`,
                            mimeType: driveFile.mimeType,
                            resourceKey: driveFile.resourceKey,
                          },
                        },
                      ],
                    },
                  },
                ])
              );
            }}
          ></bb-google-drive-file-id>
        </div> `
    );

    const topShelf = html`<div id="top-shelf">
      <div id="items">${items}</div>
    </div>`;

    const shelf = html`<div id="shelf">
      ${this.sca.env.flags.get("enableGraphEditorAgent")
        ? html`<bb-graph-editing-chat
            @pointerdown=${(evt: PointerEvent) => {
              evt.stopPropagation();
            }}
          ></bb-graph-editing-chat>`
        : html`<bb-flowgen-editor-input
            @pointerdown=${(evt: PointerEvent) => {
              // <bb-renderer> listens for pointerdown and retains focus so that
              // after selection updates the user can do things like delete nodes
              // with the keyboard. The corresponding effect makes it impossible to
              // interact with this element so we catch the event here first.
              evt.stopPropagation();
            }}
          ></bb-flowgen-editor-input>`}
    </div>`;

    const graphControls = html`<div id="graph-controls">
      <button
        id="zoom-to-fit"
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              Strings.from("COMMAND_ZOOM_TO_FIT"),
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          let animate = true;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            animate = false;
          }

          this.dispatchEvent(new ZoomToFitEvent(animate));
        }}
      >
        <span class="g-icon filled round">fit_screen</span>
      </button>

      <button
        id="zoom-in"
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              Strings.from("COMMAND_ZOOM_IN"),
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          let animate = true;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            animate = false;
          }

          this.dispatchEvent(new ZoomInEvent(animate));
        }}
      >
        <span class="g-icon filled round">add</span>
      </button>

      <button
        id="zoom-out"
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              Strings.from("COMMAND_ZOOM_OUT"),
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          let animate = true;
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            animate = false;
          }

          this.dispatchEvent(new ZoomOutEvent(animate));
        }}
      >
        <span class="g-icon filled round">remove</span>
      </button>

      <button
        id="undo"
        ?disabled=${!this.history?.canUndo()}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              Strings.from("COMMAND_UNDO"),
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          this.dispatchEvent(
            new StateEvent<"board.undo">({ eventType: "board.undo" })
          );
        }}
      >
        <span class="g-icon filled round">undo</span>
      </button>
      <button
        id="redo"
        ?disabled=${!this.history?.canRedo()}
        @pointerover=${(evt: PointerEvent) => {
          this.dispatchEvent(
            new ShowTooltipEvent(
              Strings.from("COMMAND_REDO"),
              evt.clientX,
              evt.clientY
            )
          );
        }}
        @pointerout=${() => {
          this.dispatchEvent(new HideTooltipEvent());
        }}
        @click=${() => {
          this.dispatchEvent(
            new StateEvent<"board.redo">({ eventType: "board.redo" })
          );
        }}
      >
        <span class="g-icon filled round">redo</span>
      </button>
    </div>`;

    let componentPicker: HTMLTemplateResult | symbol = nothing;
    if (this.showComponentPicker) {
      this.style.setProperty(
        "--component-picker-x",
        `${this.#componentPickerConfiguration.x}px`
      );
      this.style.setProperty(
        "--component-picker-y",
        `${this.#componentPickerConfiguration.y}px`
      );
      let lastOrderIndex = 0;
      componentPicker = html`<div
        id="component-picker"
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
      >
        ${this.#componentPickerConfiguration.components.length
          ? html`<ul id="components">
              ${map(
                this.#componentPickerConfiguration.components,
                (kitContents) => {
                  const className = kitContents.id
                    .toLocaleLowerCase()
                    .replaceAll(/\W/gim, "-");
                  const id = kitContents.id;
                  const title = kitContents.metadata.title || id;
                  const icon = kitContents.metadata.icon ?? "generic";
                  const orderIndex =
                    kitContents.metadata.order || Number.MAX_SAFE_INTEGER;
                  const displaySeparator = orderIndex - lastOrderIndex > 1;
                  lastOrderIndex = orderIndex;

                  return html`<li
                    class=${classMap({
                      [className]: true,
                      ["kit-item"]: true,
                      ["separator"]: displaySeparator,
                    })}
                    draggable="true"
                    @click=${() => this.#handleChosenKitItem(id)}
                    @dragstart=${(evt: DragEvent) => {
                      if (!evt.dataTransfer) {
                        return;
                      }
                      evt.dataTransfer.setData(DATA_TYPE, id);
                    }}
                  >
                    <div
                      class=${classMap({
                        "node-icon": true,
                        [icon]: true,
                      })}
                    ></div>
                    <div>
                      <div class="node-id">${title}</div>
                    </div>
                  </li>`;
                }
              )}
            </ul>`
          : html`<div class="no-components-available">
              ${Strings.from("LABEL_NO_COMPONENTS")}
            </div>`}
      </div>`;
    }

    return [topShelf, shelf, graphControls, componentPicker];
  }
}
