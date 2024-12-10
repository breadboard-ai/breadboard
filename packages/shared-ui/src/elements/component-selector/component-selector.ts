/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import {
  GraphStoreEntry,
  Kit,
  MainGraphIdentifier,
  MutableGraphStore,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import { KitNodeChosenEvent } from "../../events/events.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";

const DATA_TYPE = "text/plain";

@customElement("bb-component-selector")
export class ComponentSelector extends LitElement {
  @property()
  boardServerKits: Kit[] | null = null;

  @property()
  mainGraphId: MainGraphIdentifier | null = null;

  @property()
  graphStore: MutableGraphStore | null = null;

  @state()
  filter: string | null = null;

  @property()
  showExperimentalComponents = false;

  @property()
  graphStoreUpdateId = 0;

  @property()
  persist = false;

  @property()
  static = false;

  #searchInputRef: Ref<HTMLInputElement> = createRef();

  #graphURL: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      height: 100%;
    }

    #content {
      width: 100%;
      height: calc(100% - var(--bb-grid-size-12));
      overflow-y: auto;
    }

    #container {
      height: 100%;
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
      padding: 0 var(--bb-grid-size-2) var(--bb-grid-size-8)
        var(--bb-grid-size-2);
    }

    #controls {
      height: var(--bb-grid-size-12);
      padding: var(--bb-grid-size-2);
      display: grid;
      column-gap: var(--bb-grid-size-2);
    }

    #controls input[type="text"],
    #controls input[type="search"],
    #controls select,
    #controls textarea {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    #search:focus {
      outline: none;
      box-shadow: inset 0 0 0 4px var(--bb-ui-50);
    }

    #search:not(:placeholder-shown) {
      background: var(--bb-neutral-0);
    }

    details {
      margin: var(--bb-grid-size) 0;
    }

    details:first-of-type {
      margin-top: 0;
    }

    summary {
      height: 28px;
      background: var(--bb-neutral-100) var(--bb-icon-unfold-more)
        calc(100% - 4px) center / 20px 20px no-repeat;
      list-style: none;
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding: 0 8px;
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      cursor: pointer;
    }

    details[open] summary {
      background: var(--bb-neutral-100) var(--bb-icon-unfold-less)
        calc(100% - 4px) center / 20px 20px no-repeat;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    form {
      border-radius: 0 0 var(--bb-grid-size-2) var(--bb-grid-size-2);
      flex: 1;
    }

    .kit-contents ul {
      margin: 0;
      padding: 0 0 var(--bb-grid-size-3) 0;
      display: block;
      list-style: none;
    }

    .kit-contents ul li.kit-item .node-id {
      position: relative;
      white-space: nowrap;
      margin: var(--bb-grid-size) 0;
      font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    .kit-contents ul li.kit-item .node-description {
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      white-space: normal;
      position: relative;
      overflow: hidden;
    }

    .kit-contents ul li.kit-item {
      margin: var(--bb-grid-size) 0;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      width: 100%;
      border-radius: 12px;
      position: relative;
      background: #fff;
      cursor: grab;
      display: grid;
      grid-template-columns: 28px minmax(0, auto);
      column-gap: var(--bb-grid-size-2);
    }

    .kit-contents ul li.kit-item:hover::before {
      content: "";
      background: var(--bb-ui-50);
      position: absolute;
      left: var(--bb-grid-size-2);
      top: 1px;
      bottom: 1px;
      right: var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size);
      z-index: 0;
      opacity: 1;
    }

    .kit-contents ul li.kit-item:active {
      cursor: grabbing;
    }

    .kit-contents ul li.kit-item span {
      position: relative;
      z-index: 1;
    }

    .kit-contents ul li.kit-item .node-icon {
      position: relative;
    }

    .kit-contents ul li.kit-item .node-icon::before {
      content: "";
      position: absolute;
      width: 28px;
      height: 28px;
      background: var(--bb-icon-board) top left / 28px 28px no-repeat;
      top: 0;
      left: 0;
    }

    .kit-contents ul li.kit-item .node-icon.code-blocks::before {
      background: var(--bb-icon-code-blocks) top left / 28px 28px no-repeat;
    }

    .kit-contents ul li.kit-item .node-icon.smart-toy::before {
      background: var(--bb-icon-smart-toy) top left / 28px 28px no-repeat;
    }

    .kit-contents ul li.kit-item .node-icon.human::before {
      background: var(--bb-icon-human) top left / 28px 28px no-repeat;
    }

    .kit-contents ul li.kit-item .node-icon.merge-type::before {
      background: var(--bb-icon-merge-type) top left / 28px 28px no-repeat;
    }

    .kit-contents ul li.kit-item .node-icon.laps::before {
      background: var(--bb-icon-laps) top left / 28px 28px no-repeat;
    }

    .kit-contents ul li.kit-item .node-icon.google-drive::before {
      background: var(--bb-icon-google-drive) top left / 28px 28px no-repeat;
    }

    .no-components {
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      margin: var(--bb-grid-size-2);
    }
  `;

  #createKitList(
    graphStore: MutableGraphStore,
    mainGraphId: MainGraphIdentifier
  ) {
    const kitList = new Map<
      string,
      { id: string; metadata: GraphStoreEntry }[]
    >();
    const graphs = graphStore.graphs();
    graphs.sort((graph1, graph2) => {
      const title1 = graph1.mainGraph.title || "";
      const title2 = graph2.mainGraph.title || "";
      if (title1 > title2) {
        return 1;
      }
      if (title1 < title2) {
        return -1;
      }
      return (graph1.title || "") > (graph2.title || "") ? 1 : -1;
    });

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

      let group = kitList.get(mainGraph.title);
      if (!group) {
        group = [];
        kitList.set(mainGraph.title, group);
      }
      group.push({ id: graph.url!, metadata: graph });
    }
    return kitList;
  }

  #filterKitList(
    kitList: Map<string, { id: string; metadata: NodeHandlerMetadata }[]>
  ) {
    if (!this.filter) {
      return kitList;
    }

    const filteredKitList = new Map<
      string,
      { id: string; metadata: NodeHandlerMetadata }[]
    >();

    const filter = new RegExp(this.filter, "gim");

    for (const [kitName, kitContents] of kitList) {
      const filteredKitContents = kitContents.filter(
        (nodeTypeInfo) =>
          filter.test(nodeTypeInfo.id) ||
          (nodeTypeInfo.metadata.title &&
            filter.test(nodeTypeInfo.metadata.title))
      );

      if (filteredKitContents.length > 0) {
        filteredKitList.set(kitName, filteredKitContents);
      }
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
    const allKits = this.#createKitList(this.graphStore, this.mainGraphId);

    const before = allKits.size;
    const kitList = this.#filterKitList(allKits);
    const expandAll = before > kitList.size;

    return html` <div id="controls">
        <input
          type="search"
          id="search"
          slot="search"
          placeholder="Search for an item"
          value=${this.filter || ""}
          ${ref(this.#searchInputRef)}
          @input=${(evt: InputEvent) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.filter = evt.target.value;
          }}
        />
      </div>
      <div id="content">
        <div id="container">
          <form>
            ${map(kitList, ([kitName, kitContents]) => {
              const kitId = kitName.toLocaleLowerCase().replace(/\W/gim, "-");

              // Prevent the user from accidentally embedding the
              // current tool graph inside of itself.
              kitContents = kitContents.filter(
                (nodeTypeInfo) => nodeTypeInfo.id !== this.#graphURL
              );

              return html`<details
                ?open=${expandAll || kitName === "Agent Kit"}
              >
                <summary for="${kitId}"><span>${kitName}</span></summary>
                <div class="kit-contents">
                  ${kitContents.length
                    ? html`<ul>
                        ${map(kitContents, (nodeTypeInfo) => {
                          const className = nodeTypeInfo.id
                            .toLocaleLowerCase()
                            .replaceAll(/\W/gim, "-");
                          const id = nodeTypeInfo.id;
                          const description = nodeTypeInfo.metadata.description;
                          const title = nodeTypeInfo.metadata.title || id;
                          const icon = nodeTypeInfo.metadata.icon ?? "generic";

                          return html`<li
                            class=${classMap({
                              [className]: true,
                              ["kit-item"]: true,
                            })}
                            draggable="true"
                            @dblclick=${() => {
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
                      </ul>`
                    : html`<div class="no-components">
                        No components available
                      </div>`}
                </div>
              </details>`;
            })}
          </form>
        </div>
      </div>`;
  }
}
