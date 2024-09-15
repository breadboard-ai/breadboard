/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableGraph,
  InspectableKit,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { KitNodeChosenEvent } from "../../events/events.js";
import { Task } from "@lit/task";

const DATA_TYPE = "text/plain";

@customElement("bb-node-selector")
export class NodeSelector extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @state()
  filter: string | null = null;

  @property()
  showExperimentalComponents = false;

  #searchInputRef: Ref<HTMLInputElement> = createRef();
  #listRef: Ref<HTMLUListElement> = createRef();
  #lastSelectedId: string | null = null;
  #kitInfoTask = new Task(this, {
    task: async () => {
      return this.#createKitList(this.graph?.kits() || []);
    },
    args: () => [this.graph?.kits() || []],
  });

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: grid;
      background: #ededed;
      border-radius: 12px;
      box-shadow:
        0px 1px 2px rgba(0, 0, 0, 0.3),
        0px 1px 3px 1px rgba(0, 0, 0, 0.15);
      padding: 8px;

      --border-radius: 32px;
      --kit-height: 24px;
      --kit-margin: 1px;
      --kit-count: 2;
      --height: calc(var(--kit-count) * (var(--kit-height)));
    }

    #container {
      display: grid;
    }

    #search {
      margin-bottom: 8px;
      border-radius: 8px;
      border: none;
      height: 24px;
      padding-left: 24px;
      background: #fff var(--bb-icon-search) 4px center no-repeat;
      background-size: 16px 16px;
    }

    #kit-list {
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      list-style: none;
      font-size: var(--bb-text-small);
      color: #222;
      height: var(--height);
      position: relative;
      width: min(80vw, 360px);
    }

    #kit-list > li {
      width: 40%;
    }

    input[type="radio"] {
      display: none;
    }

    label {
      height: var(--kit-height);
      display: block;
      border-radius: var(--border-radius) 0 0 var(--border-radius);
      padding: 0 12px;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      position: relative;
      cursor: pointer;
      line-height: var(--kit-height);
      color: #1a1a1a;
    }

    li.kit-item .node-id {
      white-space: nowrap;
      height: var(--kit-height);
      line-height: var(--kit-height);
      font: 600 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
    }

    li.kit-item .node-description {
      font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
    }

    #kit-list li:hover label::before {
      content: "";
      background: #000;
      position: absolute;
      left: 1px;
      top: 1px;
      bottom: 1px;
      right: 8px;
      border-radius: var(--bb-grid-size-12);
      z-index: 0;
      opacity: 0.1;
    }

    #kit-list li:hover label span {
      position: relative;
      z-index: 1;
    }

    label {
      opacity: 0.5;
    }

    input[type="radio"]:checked ~ label {
      background: #fff;
      border-radius: var(--border-radius) 0 0 var(--border-radius);
      position: relative;
      opacity: 1;
    }

    input[type="radio"]:checked ~ label::before {
      display: none;
    }

    input[type="radio"] ~ .kit-contents {
      display: none;
    }

    input[type="radio"]:checked ~ .kit-contents {
      display: block;
      position: absolute;
      left: 40%;
      top: 0;
      height: var(--height);
      overflow-y: scroll;
      scrollbar-gutter: stable;
      background: #fff;
      margin: 0;
      width: 60%;
      border-radius: 8px;
    }

    .kit-contents ul {
      display: block;
    }

    #kit-list
      li:first-of-type:last-of-type
      input[type="radio"]:checked
      ~ .kit-contents,
    #kit-list li:first-of-type input[type="radio"]:checked ~ .kit-contents {
      border-radius: 0 8px 8px 8px;
    }

    #kit-list li:last-of-type input[type="radio"]:checked ~ .kit-contents {
      border-radius: 8px 8px 8px 0;
    }

    .kit-contents ul {
      padding: 0;
      margin: 0;
    }

    li.kit-item {
      margin: var(--bb-grid-size) 0;
      padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
      width: 100%;
      border-radius: 12px;
      position: relative;
      background: #fff;
      cursor: grab;
    }

    li.kit-item:hover::before {
      content: "";
      background: #000;
      position: absolute;
      left: var(--bb-grid-size-2);
      top: 1px;
      bottom: 1px;
      right: var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size);
      z-index: 0;
      opacity: 0.05;
    }

    li.kit-item:active {
      cursor: grabbing;
    }

    li.kit-item span {
      position: relative;
      z-index: 1;
    }
  `;

  selectSearchInput() {
    if (!this.#searchInputRef.value) {
      return;
    }

    this.#searchInputRef.value.select();
  }

  updated() {
    if (!this.#listRef.value) {
      return;
    }

    if (this.#listRef.value.querySelector("input[checked]")) {
      return;
    }

    if (this.#lastSelectedId) {
      const lastInput = this.#listRef.value.querySelector(
        `#${this.#lastSelectedId}`
      ) as HTMLInputElement;
      if (lastInput) {
        lastInput.checked = true;
        return;
      }
    }

    const firstInput = this.#listRef.value.querySelector("input");
    if (!firstInput) {
      return;
    }

    firstInput.checked = true;
  }

  async #createKitList(kits: InspectableKit[]) {
    const kitList = new Map<
      string,
      { id: string; metadata: NodeHandlerMetadata }[]
    >();
    kits.sort((kit1, kit2) =>
      (kit1.descriptor.title || "") > (kit2.descriptor.title || "") ? 1 : -1
    );

    for (const kit of kits) {
      if (!kit.descriptor.title) {
        continue;
      }

      if (kit.descriptor.tags?.includes("deprecated")) {
        continue;
      }

      if (
        !this.showExperimentalComponents &&
        kit.descriptor.tags?.includes("experimental")
      ) {
        continue;
      }

      const typeMetadata = (
        await Promise.all(
          kit.nodeTypes.map(async (node) => {
            const metadata = await node.metadata();
            if (
              !this.showExperimentalComponents &&
              metadata.tags?.includes("experimental")
            ) {
              return null;
            }
            return { id: node.type(), metadata: await node.metadata() };
          })
        )
      ).filter(Boolean) as { id: string; metadata: NodeHandlerMetadata }[];

      const available = typeMetadata.filter(
        ({ metadata }) => !metadata.deprecated
      );

      if (available.length === 0) {
        continue;
      }

      kitList.set(kit.descriptor.title, available);
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

  render() {
    if (!this.graph) {
      return nothing;
    }

    const kits = this.graph.kits() || [];

    this.style.setProperty("--kit-count", kits.length.toString());

    return this.#kitInfoTask.render({
      pending: () => html`<div>Loading...</div>`,
      complete: (kitList) => {
        kitList = this.#filterKitList(kitList);

        return html` <div
          id="container"
          @pointerdown=${(evt: Event) => evt.stopPropagation()}
        >
          <input
            type="search"
            id="search"
            placeholder="Search nodes"
            value=${this.filter || ""}
            ${ref(this.#searchInputRef)}
            @input=${(evt: InputEvent) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              this.filter = evt.target.value;
            }}
          />
          <form>
            <ul id="kit-list" ${ref(this.#listRef)}>
              ${map(kitList, ([kitName, kitContents]) => {
                const kitId = kitName.toLocaleLowerCase().replace(/\W/gim, "-");
                return html`<li>
                  <input
                    type="radio"
                    name="selected-kit"
                    id="${kitId}"
                    @click=${(evt: Event) => {
                      if (!(evt.target instanceof HTMLElement)) {
                        return;
                      }

                      this.#lastSelectedId = evt.target.id;
                    }}
                  /><label for="${kitId}"><span>${kitName}</span></label>
                  <div class="kit-contents">
                    <ul>
                      ${map(kitContents, (nodeTypeInfo) => {
                        const className = nodeTypeInfo.id
                          .toLocaleLowerCase()
                          .replaceAll(/\W/gim, "-");
                        const id = nodeTypeInfo.id;
                        const description = nodeTypeInfo.metadata.description;
                        const title = nodeTypeInfo.metadata.title || id;
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
                          <div class="node-id">${title}</div>
                          ${description
                            ? html`<div class="node-description">
                                ${description}
                              </div>`
                            : nothing}
                        </li>`;
                      })}
                    </ul>
                  </div>
                </li>`;
              })}
            </ul>
          </form>
          <div></div>
        </div>`;
      },
    });
  }
}
