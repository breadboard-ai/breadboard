/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Editor");

import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  HideTooltipEvent,
  KitNodeChosenEvent,
  ShowAssetOrganizerEvent,
  ShowTooltipEvent,
  ToastEvent,
  ToastType,
  ZoomInEvent,
  ZoomOutEvent,
  ZoomToFitEvent,
} from "../../events/events.js";
import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  GraphStoreEntry,
  GraphStoreUpdateEvent,
  InspectableGraph,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  PortIdentifier,
} from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { DATA_TYPE } from "./constants.js";
import { CreateNewAssetsEvent, NodeAddEvent } from "./events/events.js";
import { isA2 } from "@breadboard-ai/a2";
import { until } from "lit/directives/until.js";
import { GoogleDriveFileId, ItemSelect } from "../elements.js";
import { NewAsset } from "../../types/types.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { SIGN_IN_CONNECTION_ID } from "../../utils/signin-adapter.js";
import { InputChangeEvent } from "../../plugins/input-plugin.js";
import { icons } from "../../styles/icons.js";

const QUICK_ADD_ADJUSTMENT = -20;

@customElement("bb-editor-controls")
export class EditorControls extends LitElement {
  @property()
  accessor readOnly = false;

  @property()
  accessor boardServerKits: Kit[] | null = null;

  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor graphStore: MutableGraphStore | null = null;

  @property()
  accessor graphStoreUpdateId = 0;

  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @property()
  accessor showDefaultAdd = false;

  @property()
  accessor showExperimentalComponents = false;

  @state()
  accessor showComponentLibrary = false;
  #componentLibraryConfiguration: {
    x: number;
    y: number;
    freeDrop: boolean;
    id: NodeIdentifier | null;
    portId: PortIdentifier | null;
    subGraphId: GraphIdentifier | null;
  } | null = null;

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

      #default-add {
        position: fixed;
        top: 100px;
        left: 50%;
        translate: -50% 0;
        z-index: 4;
        border: 1px solid var(--bb-neutral-300);
        color: var(--bb-neutral-600);
        font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
          var(--bb-font-family);
        border-radius: var(--bb-grid-size-16);
        background: transparent var(--bb-icon-library-add) 8px center / 20px
          20px no-repeat;
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
        transition: border 0.2s cubic-bezier(0, 0, 0.3, 1);
        height: var(--bb-grid-size-7);
        cursor: pointer;

        &:hover {
          border: 1px solid var(--bb-neutral-500);
        }
      }

      #graph-controls {
        position: absolute;
        display: flex;
        flex-direction: column;
        right: var(--bb-grid-size-6);
        bottom: var(--bb-grid-size-7);
        background: var(--bb-neutral-0);
        border-radius: var(--bb-grid-size-16);
        padding: var(--bb-grid-size) var(--bb-grid-size);
        box-shadow: var(--bb-elevation-16-light);

        &::before {
          content: "";
          position: absolute;
          width: calc(100% - 2px);
          height: 1px;
          left: 1px;
          top: var(--bb-grid-size-12);
          background: var(--bb-neutral-200);
        }

        & button {
          font-size: 0;
          background: var(--bb-neutral-0) var(--bb-icon-fit) center center /
            20px 20px no-repeat;
          width: var(--bb-grid-size-7);
          height: var(--bb-grid-size-7);
          padding: 0;
          border: none;
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
          border-radius: var(--bb-grid-size);

          &#zoom-to-fit {
            height: var(--bb-grid-size-10);
            background-image: var(--bb-icon-fit);
            margin-bottom: var(--bb-grid-size);
            border-radius: var(--bb-grid-size-12) var(--bb-grid-size-12)
              var(--bb-grid-size) var(--bb-grid-size);
          }

          &#zoom-in {
            background-image: var(--bb-icon-add);
            margin-top: var(--bb-grid-size);
          }

          &#zoom-out {
            background-image: var(--bb-icon-remove);
            border-radius: var(--bb-grid-size) var(--bb-grid-size)
              var(--bb-grid-size-12) var(--bb-grid-size-12);
          }

          &:not([disabled]) {
            cursor: pointer;

            &:hover,
            &:focus {
              background-color: var(--bb-neutral-50);
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
          box-shadow: var(--bb-elevation-16-heavy);
          background: var(--bb-neutral-0);
          padding: 0;

          & bb-item-select {
            position: relative;
            margin: 0 2px;

            --menu-width: 200px;
            --selected-item-column-gap: var(--bb-grid-size);
            --selected-item-height: var(--bb-grid-size-9);
            --selected-item-hover-color: var(--bb-neutral-50);
            --selected-item-border-radius: var(--bb-grid-size-2)
              var(--bb-grid-size-16) var(--bb-grid-size-16)
              var(--bb-grid-size-2);
            --selected-item-font: 400 var(--bb-label-large) /
              var(--bb-label-line-height-large) var(--bb-font-family);
            --selected-item-title-padding: 0 var(--bb-grid-size-2) 0 0;

            &::before {
              content: "";
              height: calc(100% + 4px);
              position: absolute;
              top: -2px;
              left: -3px;
              translate: -0.5px 0;
              border-left: 1px solid var(--bb-neutral-100);
            }
          }

          & button {
            margin-right: var(--bb-grid-size);
            background-color: var(--bb-neutral-0);
            transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

            &:first-of-type {
              border-radius: var(--bb-grid-size-16) var(--bb-grid-size-2)
                var(--bb-grid-size-2) var(--bb-grid-size-16);
              margin-left: 2px;
              padding-left: var(--bb-grid-size-4);
            }

            &:hover,
            &:focus {
              background-color: var(--bb-neutral-50);
            }

            &::before {
              content: "";
              width: 20px;
              height: 20px;
              margin-right: var(--bb-grid-size-2);
              background: var(--bb-icon-board) center center / 20px 20px
                no-repeat;
            }

            &.generative::before {
              background-image: var(--bb-add-icon-generative);
            }

            &.input::before {
              background-image: var(--bb-icon-input);
            }

            &.combine-outputs::before {
              background-image: var(--bb-icon-table-rows);
            }

            &.display::before {
              background-image: var(--bb-icon-responsive-layout);
            }

            &.ask-user::before {
              background-image: var(--bb-icon-chat-mirror);
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
          background: var(--bb-neutral-0);
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

          &#show-asset-organizer {
            justify-content: center;
            border-radius: 50%;
            background: var(--bb-neutral-0);
            width: var(--bb-grid-size-10);
            height: var(--bb-grid-size-10);
            box-shadow: var(--bb-elevation-16-heavy);
            margin-left: var(--bb-grid-size-3);
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
        background: var(--bb-neutral-0);
        border: 1px solid var(--bb-neutral-300);
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
              background: var(--bb-neutral-50);
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
              color: var(--bb-neutral-900);
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
            border-top: 1px solid var(--bb-neutral-200);
          }
        }
      }

      bb-component-selector-overlay {
        position: absolute;
        bottom: 52px;
        left: 50%;
        transform: translateX(-50%) translateX(-29px);
        z-index: 8;
        animation: slideIn 0.2s cubic-bezier(0, 0, 0.3, 1) forwards;

        &[detached="true"] {
          position: fixed;
          left: var(--component-library-x, 100px);
          top: var(--component-library-y, 100px);
          right: auto;
          bottom: auto;
          transform: none;
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
    this.#componentLibraryConfiguration = null;
    this.showComponentLibrary = false;
    this.showComponentPicker = false;
  }

  #attemptGDrivePickerFlow() {
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

  #createComponentList(graphStore: MutableGraphStore, typeTag: string) {
    const kitList: Array<{ id: string; metadata: GraphStoreEntry }> = [];
    const graphs = graphStore.graphs();

    for (const graph of graphs) {
      const { mainGraph } = graph;
      if (!isA2(mainGraph.url)) continue;

      // Don't show items that are still updating.
      if (graph.updating) continue;

      // Skip items that don't belong in Quick Access component picker.
      if (!graph.tags?.includes("quick-access")) continue;

      // Skip items that don't aren't of specified type
      if (!graph.tags?.includes(typeTag)) continue;

      if (!graph.title) {
        continue;
      }

      if (
        !mainGraph.title ||
        mainGraph.tags?.includes("deprecated") ||
        !graph.tags?.includes("component") ||
        graph.tags?.includes("deprecated")
      ) {
        continue;
      }

      if (
        !this.showExperimentalComponents &&
        mainGraph.tags?.includes("experimental")
      ) {
        continue;
      }

      if (
        !this.showExperimentalComponents &&
        graph.tags?.includes("experimental")
      ) {
        continue;
      }

      // This should not be necessary, but currently is, because the
      // GraphStore gets polluted with graphs that are silently converted
      // from imperative to declarative (hence "module:" URL).
      // TODO(dglazkov): Refactor graphstore machinery to make this not
      //                 necessary.
      if (mainGraph.url?.startsWith("module:")) continue;

      kitList.push({ id: graph.url!, metadata: graph });
    }

    kitList.sort((kit1, kit2) => {
      const order1 = kit1.metadata.order || Number.MAX_SAFE_INTEGER;
      const order2 = kit2.metadata.order || Number.MAX_SAFE_INTEGER;
      if (order1 != order2) return order1 - order2;
      return (kit1.metadata.title || "") > (kit2.metadata.title || "") ? 1 : -1;
    });

    if (typeTag === "tool") {
      const subGraphs =
        (this.mainGraphId
          ? this.graphStore?.get(this.mainGraphId)?.graph.graphs
          : {}) || {};
      kitList.push(
        ...Object.entries(subGraphs).map(([graphId, descriptor]) => {
          const id = `#${graphId}`;
          return {
            id,
            metadata: {
              mainGraph: {
                id: this.mainGraphId!,
              },
              updating: false,
              title: descriptor.title,
              ...descriptor.metadata,
            },
          };
        })
      );
    }

    if (typeTag === "modules") {
      const modules =
        (this.mainGraphId
          ? this.graphStore?.inspect(this.mainGraphId, "")?.modules()
          : {}) || {};

      for (const [moduleId, module] of Object.entries(modules)) {
        if (!module.metadata().runnable) {
          continue;
        }

        const id = `#module:${moduleId}`;
        kitList.push({
          id,
          metadata: {
            mainGraph: {
              id: this.mainGraphId!,
            },
            updating: false,
            title: module.metadata().title,
            icon: module.metadata().icon,
            description: module.metadata().description,
          },
        });
      }
    }

    return kitList;
  }

  showComponentLibraryAt(
    x: number,
    y: number,
    nodeId: string,
    subGraphId: string | null
  ) {
    this.#componentLibraryConfiguration = {
      x: x,
      y: y,
      freeDrop: true,
      id: nodeId,
      subGraphId: subGraphId,
      portId: null,
    };
    this.showComponentLibrary = true;
  }

  #storeReady: Promise<void> = Promise.resolve();
  willUpdate() {
    this.#storeReady = Promise.resolve();
    if (this.graphStore) {
      this.#storeReady = new Promise((resolve) => {
        if (!this.graphStore) {
          resolve();
          return;
        }

        const awaitingUpdate = new Set<string>();
        const onGraphUpdate = (evt: GraphStoreUpdateEvent) => {
          if (awaitingUpdate.has(evt.mainGraphId)) {
            awaitingUpdate.delete(evt.mainGraphId);
          }

          if (awaitingUpdate.size === 0) {
            this.graphStore?.removeEventListener(
              "update",
              onGraphUpdate as EventListener
            );
            resolve();
          }
        };

        this.graphStore.addEventListener("update", onGraphUpdate);

        for (const graph of this.graphStore.graphs()) {
          if (!graph.updating) {
            continue;
          }

          awaitingUpdate.add(graph.mainGraph.id);
        }

        if (awaitingUpdate.size === 0) {
          resolve();
        }
      });
    }
  }

  #handleChosenKitItem(nodeType: string) {
    let x;
    let y;
    let nodeId;
    let subGraphId;
    let createAtCenter = true;
    if (this.#componentLibraryConfiguration?.freeDrop) {
      x = this.#componentLibraryConfiguration.x;
      y = this.#componentLibraryConfiguration.y;
      nodeId = this.#componentLibraryConfiguration.id ?? undefined;
      subGraphId = this.#componentLibraryConfiguration.subGraphId ?? undefined;
      createAtCenter = false;
    }
    this.dispatchEvent(
      new NodeAddEvent(nodeType, createAtCenter, x, y, nodeId, subGraphId)
    );
    this.hidePickers();
  }

  render() {
    if (!this.graph) {
      return nothing;
    }

    let defaultAdd: HTMLTemplateResult | symbol = nothing;
    if (this.showDefaultAdd) {
      defaultAdd = html`<button
        id="default-add"
        @click=${async (evt: PointerEvent) => {
          await this.#storeReady;
          this.#componentLibraryConfiguration = {
            x: evt.clientX - 165,
            y: 80,
            freeDrop: false,
            id: null,
            subGraphId: null,
            portId: null,
          };
          this.showComponentLibrary = true;
        }}
      >
        ${Strings.from("LABEL_ADD_ITEM")}
      </button>`;
    }

    let componentLibrary: HTMLTemplateResult | symbol = nothing;
    if (this.showComponentLibrary) {
      const isDetached = this.#componentLibraryConfiguration !== null;
      if (this.#componentLibraryConfiguration) {
        let { x, y } = this.#componentLibraryConfiguration;
        x -= QUICK_ADD_ADJUSTMENT;
        y -= QUICK_ADD_ADJUSTMENT;

        this.style.setProperty("--component-library-x", `${x}px`);
        this.style.setProperty("--component-library-y", `${y}px`);
      } else {
        this.style.removeProperty("--component-library-x");
        this.style.removeProperty("--component-library-y");
      }

      componentLibrary = html`<bb-component-selector-overlay
        .detached=${isDetached}
        .graphStoreUpdateId=${this.graphStoreUpdateId}
        .showExperimentalComponents=${this.showExperimentalComponents}
        .boardServerKits=${this.boardServerKits}
        .graphStore=${this.graphStore}
        .mainGraphId=${this.mainGraphId}
        @bbkitnodechosen=${(evt: KitNodeChosenEvent) =>
          this.#handleChosenKitItem(evt.nodeType)}
        @pointerdown=${(evt: PointerEvent) => {
          evt.stopImmediatePropagation();
        }}
      >
      </bb-component-selector-overlay>`;
    }

    const mainItems = this.#storeReady.then(() => {
      if (!this.graphStore) {
        return html`Unable to load steps`;
      }

      // TODO: Just do this in a single pass.
      const generate = this.#createComponentList(this.graphStore, "generate");
      const input = this.#createComponentList(this.graphStore, "input");
      const output = this.#createComponentList(this.graphStore, "output");

      const items: HTMLTemplateResult[] = [
        ...input,
        ...generate,
        ...output,
      ].map((item) => {
        const classes: Record<string, boolean> = {};
        if (item.metadata.icon) {
          classes[item.metadata.icon] = true;
        }

        return html`<button
          draggable="true"
          class=${classMap(classes)}
          @click=${() => {
            this.#handleChosenKitItem(item.id);
          }}
          @dragstart=${(evt: DragEvent) => {
            if (!evt.dataTransfer) {
              return;
            }

            evt.dataTransfer.setData(DATA_TYPE, item.id);
          }}
        >
          ${item.metadata.title ?? "Untitled"}
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
                            const preamble = `data:${file.type};base64,`;
                            const data = (reader.result as string).substring(
                              preamble.length
                            );
                            resolve({
                              name: file.name,
                              mimeType: file.type,
                              data,
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
                title: "Asset",
                icon: "alternate_email",
                hidden: true,
              },
              {
                id: "text",
                title: "Text",
                icon: "edit_note",
              },
              {
                id: "upload",
                title: "Upload file",
                icon: "upload",
              },
              {
                id: "gdrive",
                title: "Google Drive",
                icon: "drive",
              },
              {
                id: "youtube",
                title: "YouTube",
                icon: "video_youtube",
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
              .connectionName=${SIGN_IN_CONNECTION_ID}
              .ownedByMeOnly=${true}
              @bb-input-change=${(evt: InputChangeEvent) => {
                const driveFile = evt.value as {
                  preview: string;
                  id: string;
                  mimeType: string;
                };

                this.dispatchEvent(
                  new CreateNewAssetsEvent([
                    {
                      path: globalThis.crypto.randomUUID(),
                      name: driveFile.preview,
                      type: "content",
                      subType: "gdrive",
                      data: {
                        role: "user",
                        parts: [
                          {
                            fileData: {
                              fileUri: driveFile.id,
                              mimeType: driveFile.mimeType,
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

      return items;
    });

    const topShelf = html`<div id="top-shelf">
      <div id="items">
        ${until(mainItems, html`<div class="loading">Loading steps...</div>`)}
      </div>

      ${this.showExperimentalComponents
        ? html`<button
            id="show-asset-organizer"
            @pointerover=${(evt: PointerEvent) => {
              this.dispatchEvent(
                new ShowTooltipEvent(
                  Strings.from("COMMAND_ASSET_ORGANIZER"),
                  evt.clientX,
                  evt.clientY
                )
              );
            }}
            @pointerout=${() => {
              this.dispatchEvent(new HideTooltipEvent());
            }}
            @click=${() => {
              this.dispatchEvent(new ShowAssetOrganizerEvent());
            }}
          >
            <span class="g-icon">more_vert</span>
          </button>`
        : nothing}
    </div>`;

    const shelf = html`<div id="shelf">
      <bb-flowgen-editor-input
        .currentGraph=${this.graph.raw()}
        @pointerdown=${(evt: PointerEvent) => {
          // <bb-renderer> listens for pointerdown and retains focus so that
          // after selection updates the user can do things like delete nodes
          // with the keyboard. The corresponding effect makes it impossible to
          // interact with this element so we catch the event here first.
          evt.stopPropagation();
        }}
      ></bb-flowgen-editor-input>
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
        Zoom to fit
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
        Zoom in
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
        Zoom out
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

    return [
      topShelf,
      shelf,
      graphControls,
      defaultAdd,
      componentLibrary,
      componentPicker,
    ];
  }
}
