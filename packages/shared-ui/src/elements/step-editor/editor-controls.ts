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
  NodeHandlerMetadata,
  PortIdentifier,
} from "@google-labs/breadboard";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { DATA_TYPE } from "./constants.js";
import { NodeAddEvent } from "./events/events.js";

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

  static styles = css`
    :host {
      display: block;
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
      background: transparent var(--bb-icon-library-add) 8px center / 20px 20px
        no-repeat;
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
      transition: border 0.2s cubic-bezier(0, 0, 0.3, 1);
      height: var(--bb-grid-size-7);
      cursor: pointer;

      &:hover {
        border: 1px solid var(--bb-neutral-500);
      }
    }

    #shelf {
      border-radius: var(--bb-grid-size-16);
      height: 100%;
      display: flex;
      align-items: center;
      padding: 0 var(--bb-grid-size) 0 var(--bb-grid-size-2);
      box-shadow: var(--bb-elevation-1);
      background: var(--bb-neutral-0);
      margin: 0 var(--bb-grid-size-4);

      & button {
        font-size: 0;
        width: var(--bb-grid-size-7);
        height: var(--bb-grid-size-9);
        border: none;
        padding: 0 var(--bb-grid-size);
        background: var(--bb-icon-board) center center / 20px 20px no-repeat;
        position: relative;
        opacity: 0.3;

        &:not([disabled]) {
          opacity: 0.6;
          cursor: pointer;
          transition: opacity 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:focus,
          &:hover {
            opacity: 1;
          }
        }

        &#preset-comment {
          background: var(--bb-icon-comment) center center / 20px 20px no-repeat;
        }

        &#show-asset-organizer {
          background: var(--bb-icon-alternate-email) 8px center / 20px 20px
            no-repeat;
          font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
          width: auto;
          border-left: 1px solid var(--bb-neutral-300);
        }

        &#zoom-to-fit {
          border-left: 1px solid var(--bb-neutral-300);
          width: var(--bb-grid-size-10);
          background: var(--bb-icon-fit) center center / 20px 20px no-repeat;
        }

        &.expandable {
          width: var(--bb-grid-size-12);
          background:
            var(--bb-icon-board) 8px center / 20px 20px no-repeat,
            var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px no-repeat;

          &#preset-all {
            border-right: 1px solid var(--bb-neutral-100);
            background:
              var(--bb-icon-library-add) 8px center / 20px 20px no-repeat,
              var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                no-repeat;
          }

          &#preset-a2 {
            background:
              var(--bb-add-icon-generative) 10px center / 16px 16px no-repeat,
              var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                no-repeat;
          }

          &#preset-built-in {
            background:
              var(--bb-icon-route) 8px center / 20px 20px no-repeat,
              var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                no-repeat;
          }

          &#preset-tools {
            background:
              var(--bb-icon-home-repair-service) 8px center / 20px 20px
                no-repeat,
              var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                no-repeat;
          }

          &#preset-modules {
            background:
              var(--bb-icon-step) 8px center / 20px 20px no-repeat,
              var(--bb-icon-keyboard-arrow-down) 28px center / 12px 12px
                no-repeat;
          }
        }
      }
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
            font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
              var(--bb-font-family);
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
              background: var(--bb-icon-comment) top left / 20px 20px no-repeat;
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
              background: var(--bb-icon-language) top left / 20px 20px no-repeat;
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
              background: var(--bb-add-icon-generative-videocam-auto) top left /
                20px 20px no-repeat;
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
  `;

  hidePickers() {
    this.#componentLibraryConfiguration = null;
    this.showComponentLibrary = false;
    this.showComponentPicker = false;
  }

  #createComponentList(graphStore: MutableGraphStore, typeTag: string) {
    const kitList: Array<{ id: string; metadata: GraphStoreEntry }> = [];
    const graphs = graphStore.graphs();

    for (const graph of graphs) {
      // Don't show items that are still updating.
      if (graph.updating) continue;

      // Skip items that don't belong in Quick Access component picker.
      if (!graph.tags?.includes("quick-access")) continue;

      // Skip items that don't aren't of specified type
      if (!graph.tags?.includes(typeTag)) continue;

      if (!graph.title) {
        continue;
      }

      const { mainGraph } = graph;
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

      // This is a temporary hack to ensure that if only the graphs that
      // are coming from "@shared" user are visible in quick access.
      // TODO(dglazkov): Make this more robust and not user-specific.
      if (!isKnownGood(mainGraph)) continue;

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

    function isKnownGood(mainGraph: NodeHandlerMetadata) {
      return (
        mainGraph.url?.includes("/@shared/") ||
        mainGraph.url?.startsWith("file:")
      );
    }
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

  #showComponentPicker(target: HTMLElement, typeTag: string) {
    if (!this.graphStore) {
      return;
    }

    const bounds = target.getBoundingClientRect();
    this.#componentPickerConfiguration = {
      components: this.#createComponentList(this.graphStore, typeTag),
      x: bounds.left - 5,
      y: window.innerHeight - bounds.top + 16,
    };

    this.showComponentPicker = !this.showComponentPicker;
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

    const shelf = html`<div id="shelf">
        <button
          id="preset-all"
          class="expandable"
          ?disabled=${this.readOnly}
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                Strings.from("COMMAND_SHOW_LIBRARY"),
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @click=${async () => {
            await this.#storeReady;
            this.showComponentLibrary = !this.showComponentLibrary;
          }}
        >
          ${Strings.from("LABEL_COMPONENT_LIBRARY")}
        </button>
        <button
          id="preset-a2"
          class="expandable"
          ?disabled=${this.readOnly}
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                Strings.from("COMMAND_LIBRARY_GROUP_1"),
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @click=${async (evt: PointerEvent) => {
            if (!(evt.target instanceof HTMLButtonElement)) {
              return;
            }

            await this.#storeReady;
            this.#showComponentPicker(evt.target, "generative");
          }}
        >
          ${Strings.from("LABEL_SHOW_LIST")}
        </button>
        <button
          id="preset-built-in"
          class="expandable"
          ?disabled=${this.readOnly}
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                Strings.from("COMMAND_LIBRARY_GROUP_2"),
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @click=${async (evt: PointerEvent) => {
            if (!(evt.target instanceof HTMLButtonElement)) {
              return;
            }

            await this.#storeReady;
            this.#showComponentPicker(evt.target, "core");
          }}
        >
          ${Strings.from("LABEL_SHOW_LIST")}
        </button>
        <button
          id="preset-tools"
          class="expandable"
          ?disabled=${this.readOnly}
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                Strings.from("COMMAND_LIBRARY_GROUP_3"),
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @click=${async (evt: PointerEvent) => {
            if (!(evt.target instanceof HTMLButtonElement)) {
              return;
            }

            await this.#storeReady;
            this.#showComponentPicker(evt.target, "tool");
          }}
        >
          ${Strings.from("LABEL_SHOW_LIST")}
        </button>
        ${
          Object.keys(this.graph.modules()).length > 0
            ? html`<button
                id="preset-modules"
                class="expandable"
                ?disabled=${this.readOnly}
                @pointerover=${(evt: PointerEvent) => {
                  this.dispatchEvent(
                    new ShowTooltipEvent(
                      Strings.from("COMMAND_LIBRARY_MODULES"),
                      evt.clientX,
                      evt.clientY
                    )
                  );
                }}
                @pointerout=${() => {
                  this.dispatchEvent(new HideTooltipEvent());
                }}
                @click=${async (evt: PointerEvent) => {
                  if (!(evt.target instanceof HTMLButtonElement)) {
                    return;
                  }

                  await this.#storeReady;
                  this.#showComponentPicker(evt.target, "modules");
                }}
              >
                ${Strings.from("LABEL_SHOW_LIST")}
              </button>`
            : nothing
        }
        <button
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
          Assets
        </button>
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
      </div>
      <bb-describe-edit-button
        popoverPosition="above"
        .label=${Strings.from("COMMAND_DESCRIBE_EDIT_FLOW")}
        .currentGraph=${this.graph.raw()}
      ></bb-describe-edit-button>
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

    return [shelf, defaultAdd, componentLibrary, componentPicker];
  }
}
