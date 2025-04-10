/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("ComponentSelector");

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  GraphStoreEntry,
  MainGraphIdentifier,
  MutableGraphStore,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import { KitNodeChosenEvent } from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { cache } from "lit/directives/cache.js";
import { isA2 } from "@breadboard-ai/a2";

const ACTIVE_KITS_KEY = "bb-component-selector-overlay-active-kits";
const DATA_TYPE = "text/plain";

@customElement("bb-component-selector-overlay")
export class ComponentSelectorOverlay extends LitElement {
  @property()
  accessor mainGraphId: MainGraphIdentifier | null = null;

  @property()
  accessor graphStore: MutableGraphStore | null = null;

  @property({ reflect: true })
  accessor detached = false;

  @property()
  accessor showExperimentalComponents = false;

  @property()
  accessor graphStoreUpdateId = 0;

  @property()
  accessor persist = false;

  @property()
  accessor static = false;

  @state()
  accessor filter: string | null = null;

  @state()
  accessor activeKits: string[] = ["A2"];

  @state()
  accessor view: "components" | "kits" = "components";

  #searchInputRef: Ref<HTMLInputElement> = createRef();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      width: 328px;
      height: 400px;
      flex-direction: column;
      color: var(--bb-neutral-900);
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      box-shadow: var(--bb-elevation-5);
    }

    header {
      display: none;
      height: 40px;
      padding: var(--bb-grid-size-3) var(--bb-grid-size-3) var(--bb-grid-size-2)
        var(--bb-grid-size-6);
      background: var(--bb-neutral-50);
      border-radius: var(--bb-grid-size-2) var(--bb-grid-size-2) 0 0;
      border-bottom: 1px solid var(--bb-neutral-300);
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
    }

    :host([detached="true"]) header {
      display: block;
    }

    #controls {
      height: 96px;
      display: grid;
      grid-template-rows: var(--bb-grid-size-9) 1fr;
      row-gap: var(--bb-grid-size-2);
      padding: var(--bb-grid-size-3) var(--bb-grid-size-3) 0
        var(--bb-grid-size-3);
      border-bottom: 1px solid var(--bb-neutral-300);

      & #search {
        grid-column: 1 / 3;
        background: var(--bb-ui-50) var(--bb-icon-search) 8px center / 20px 20px
          no-repeat;
        border-radius: var(--bb-grid-size-16);
        border: none;

        font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
          var(--bb-font-family);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-8);
      }

      & #view-toggle {
        display: flex;

        & button {
          border: none;
          border-radius: var(--bb-grid-size-16);
          background: none;
          color: var(--bb-neutral-900);
          opacity: 0.4;
          height: var(--bb-grid-size-7);
          font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
            var(--bb-font-family);
          padding: 0 var(--bb-grid-size-3);

          &[disabled] {
            opacity: 1;
            background: var(--bb-neutral-50);
          }
        }
      }
    }

    #content {
      width: 100%;
      flex: 1;
      overflow-y: auto;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      border-radius: 0 0 var(--bb-grid-size-2) var(--bb-grid-size-2);

      & ul#components {
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

          & .node-description {
            position: relative;
            color: var(--bb-neutral-700);
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
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

            &.smart-toy {
              background: var(--bb-icon-smart-toy) top left / 20px 20px
                no-repeat;
            }

            &.input {
              background: var(--bb-icon-input) top left / 20px 20px no-repeat;
            }

            &.combine-outputs {
              background: var(--bb-icon-table-rows) top left / 20px 20px
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
          }
        }
      }

      & ul#kits {
        display: flex;
        flex-direction: column;
        list-style: none;
        padding: 0;
        margin: 0;

        & li {
          display: flex;
          padding: var(--bb-grid-size) var(--bb-grid-size-2);

          & button {
            opacity: 0.5;
            cursor: pointer;
            background: transparent var(--bb-icon-check) 0 center / 20px 20px
              no-repeat;
            font: 400 var(--bb-label-medium) /
              var(--bb-label-line-height-medium) var(--bb-font-family);
            padding: 0 0 0 var(--bb-grid-size-6);
            border: none;
          }

          &.active button {
            opacity: 1;
          }
        }
      }
    }

    .no-components,
    .no-items {
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      margin: var(--bb-grid-size-2);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();

    const activeKits = globalThis.localStorage.getItem(ACTIVE_KITS_KEY);
    if (!activeKits) {
      return;
    }

    try {
      const kits = JSON.parse(activeKits);
      if (Array.isArray(kits)) {
        this.activeKits = kits;
      }
    } catch (err) {
      globalThis.localStorage.removeItem(ACTIVE_KITS_KEY);
    }
  }

  #createKitList(
    graphStore: MutableGraphStore,
    mainGraphId: MainGraphIdentifier
  ) {
    const kitList = new Set<string>();
    const graphs = graphStore.graphs();

    for (const graph of graphs) {
      if (!graph.title) {
        continue;
      }

      const { mainGraph } = graph;

      if (!mainGraph.title) {
        continue;
      }

      if (mainGraph.id === mainGraphId) {
        continue;
      }

      if (mainGraph.title === "Custom Types") {
        continue;
      }

      if (mainGraph.tags?.includes("deprecated")) {
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

      if (!graph.tags?.includes("component")) {
        continue;
      }

      if (graph.tags?.includes("deprecated")) {
        continue;
      }

      kitList.add(mainGraph.title);
    }

    return [...kitList].sort();
  }

  #createComponentList(
    graphStore: MutableGraphStore,
    mainGraphId: MainGraphIdentifier
  ) {
    const kitList: Array<{ id: string; metadata: GraphStoreEntry }> = [];
    const graphs = graphStore.graphs();

    for (const graph of graphs) {
      if (!graph.title) {
        continue;
      }

      const { mainGraph } = graph;

      if (mainGraph.title?.startsWith("A2") && !isA2(mainGraph.url)) continue;

      if (!mainGraph.title) {
        continue;
      }

      if (mainGraph.id === mainGraphId) {
        continue;
      }

      if (!this.activeKits.find((s) => mainGraph.title?.startsWith(s))) {
        continue;
      }

      if (mainGraph.title === "Custom Types") {
        continue;
      }

      if (mainGraph.tags?.includes("deprecated")) {
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

      if (!graph.tags?.includes("component")) {
        continue;
      }

      if (graph.tags?.includes("deprecated")) {
        continue;
      }

      kitList.push({ id: graph.url!, metadata: graph });
    }

    for (const [moduleId, module] of Object.entries(
      graphStore.get(mainGraphId)?.modules.modules() || {}
    )) {
      if (!module.metadata().runnable) {
        continue;
      }

      kitList.push({
        id: `#module:${moduleId}`,
        metadata: {
          mainGraph: {
            id: mainGraphId,
          },
          updating: false,
          title: module.metadata().title,
          icon: module.metadata().icon,
          description: module.metadata().description,
        },
      });
    }

    kitList.sort((kit1, kit2) => {
      const title1 = kit1.metadata.mainGraph.title || "";
      const title2 = kit2.metadata.mainGraph.title || "";
      if (title1 > title2) {
        return 1;
      }
      if (title1 < title2) {
        return -1;
      }
      return (kit1.metadata.title || "") > (kit2.metadata.title || "") ? 1 : -1;
    });

    return kitList;
  }

  #filterComponentList(
    kitList: Array<{ id: string; metadata: NodeHandlerMetadata }>
  ) {
    let filteredKitList: Array<{ id: string; metadata: NodeHandlerMetadata }> =
      [];

    if (this.filter) {
      const filter = new RegExp(this.filter, "gim");

      filteredKitList = kitList.filter(
        (nodeTypeInfo) =>
          filter.test(nodeTypeInfo.id) ||
          (nodeTypeInfo.metadata.title &&
            filter.test(nodeTypeInfo.metadata.title))
      );
    } else {
      filteredKitList = [...kitList];
    }

    return filteredKitList;
  }

  selectSearchInput() {
    if (!this.#searchInputRef.value) {
      return;
    }

    this.#searchInputRef.value.select();
  }

  render() {
    if (!this.graphStore || !this.mainGraphId) {
      return nothing;
    }

    const kitList = this.#createKitList(this.graphStore, this.mainGraphId);
    const allComponents = this.#createComponentList(
      this.graphStore,
      this.mainGraphId
    );
    const componentList = this.#filterComponentList(allComponents);

    return html` <header>${Strings.from("LABEL_TITLE")}</header>
      <div id="controls">
        <input
          id="search"
          slot="search"
          placeholder=${Strings.from("LABEL_SEARCH")}
          type="search"
          value=${this.filter || ""}
          ${ref(this.#searchInputRef)}
          @input=${(evt: InputEvent) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.filter = evt.target.value;
          }}
        />

        <div id="view-toggle">
          <button
            id="components"
            ?disabled=${this.view === "components"}
            @click=${() => {
              this.view = "components";
            }}
          >
            ${Strings.from("LABEL_BUTTON_COMPONENTS")}
          </button>

          <button
            id="kits"
            ?disabled=${this.view === "kits"}
            @click=${() => {
              this.view = "kits";
            }}
          >
            ${Strings.from("LABEL_BUTTON_KITS")}
          </button>
        </div>
      </div>
      <div id="content">
        <div id="container">
          ${this.view === "components"
            ? cache(
                html`<form>
                  ${componentList.length === 0
                    ? html`<p class="no-items">
                        ${Strings.from("STATUS_NO_ITEMS")}
                      </p>`
                    : html`<ul id="components">
                        ${map(componentList, (kitContents) => {
                          const className = kitContents.id
                            .toLocaleLowerCase()
                            .replaceAll(/\W/gim, "-");
                          const id = kitContents.id;
                          const description = kitContents.metadata.description;
                          const title = kitContents.metadata.title || id;
                          const icon = kitContents.metadata.icon ?? "generic";

                          return html`<li
                            class=${classMap({
                              [className]: true,
                              ["kit-item"]: true,
                            })}
                            draggable="true"
                            @click=${() => {
                              this.dispatchEvent(new KitNodeChosenEvent(id));
                            }}
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
                              ${description
                                ? html`<div class="node-description">
                                    ${description}
                                  </div>`
                                : nothing}
                            </div>
                          </li>`;
                        })}
                      </ul>`}
                </form>`
              )
            : cache(
                html`<div>
                  <ul id="kits">
                    ${map(kitList, (kit) => {
                      return html`<li
                        class=${classMap({
                          active: this.activeKits.includes(kit),
                        })}
                      >
                        <button
                          @click=${() => {
                            const active = new Set(this.activeKits);
                            if (active.has(kit)) {
                              active.delete(kit);
                            } else {
                              active.add(kit);
                            }

                            const kits = [...active];
                            this.activeKits = kits;
                            globalThis.localStorage.setItem(
                              ACTIVE_KITS_KEY,
                              JSON.stringify(kits)
                            );
                          }}
                        >
                          ${kit}
                        </button>
                      </li>`;
                    })}
                  </ul>
                </div>`
              )}
        </div>
      </div>`;
  }
}
