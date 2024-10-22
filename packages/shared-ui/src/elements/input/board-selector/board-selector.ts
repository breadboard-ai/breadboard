/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  BoardServer,
  SubGraphs,
} from "@google-labs/breadboard";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { map } from "lit/directives/map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { SubGraphChosenEvent } from "../../../events/events.js";

@customElement("bb-board-selector")
export class BoardSelector extends LitElement {
  @property()
  graph: GraphDescriptor | null = null;

  @property()
  boardServers: BoardServer[] = [];

  @property()
  subGraphs: SubGraphs | null = null;

  @state()
  usingCustomURL = false;

  #inputRef: Ref<HTMLInputElement> = createRef();
  #selectorRef: Ref<HTMLSelectElement> = createRef();
  #board: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    #board-selector {
      display: grid;
      grid-template-columns: 1fr auto;
    }

    #quick-switch {
      height: 32px;
      width: 24px;
      margin-left: 12px;
      opacity: 0.5;
      border: none;
      background: var(--bb-icon-quick-jump) center center no-repeat;
      font-size: 0;
      cursor: pointer;
    }

    #quick-switch:hover {
      opacity: 1;
    }

    select {
      display: block;
      font-family: var(--bb-font-family-mono);
      font-size: var(--bb-body-x-small);
      line-height: var(--bb-body-line-height-x-small);
      border-radius: var(--bb-grid-size);
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
      width: 100%;
    }

    input {
      font-family: var(--bb-font-family-mono);
      font-size: var(--bb-body-x-small);
      line-height: var(--bb-body-line-height-x-small);
      resize: none;
      display: block;
      box-sizing: border-box;
      width: 100%;
      field-sizing: content;
      max-height: 300px;
      border-radius: var(--bb-grid-size);
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
      margin-top: var(--bb-grid-size);
    }
  `;

  get value() {
    if (this.#inputRef.value) {
      if (!this.#inputRef.value.checkValidity()) {
        this.#inputRef.value.reportValidity();
      }

      return this.#inputRef.value.value;
    }

    if (!this.#selectorRef.value) {
      return null;
    }

    return this.#selectorRef.value.value;
  }

  set value(value: string | null) {
    this.#board = value;
    this.requestUpdate();
  }

  protected willUpdate(): void {
    if (this.subGraphs && this.#board && this.subGraphs[this.#board.slice(1)]) {
      this.usingCustomURL = false;
      return;
    }

    for (const boardServer of this.boardServers) {
      for (const [, store] of boardServer.items()) {
        for (const [, { url, tags }] of store.items) {
          const expandedUrl = new URL(url, window.location.href);
          if (this.#board === expandedUrl.href && tags?.includes("tool")) {
            this.usingCustomURL = false;
            return;
          }
        }
      }
    }

    if (this.#board === "") {
      return;
    }

    this.usingCustomURL = true;
  }

  render() {
    const showQuickSwitch = this.#board && this.#board.startsWith("#");
    const boardServers = this.boardServers.filter((provider) =>
      this.graph && this.graph.url
        ? provider.canProvide(new URL(this.graph.url))
        : false
    );

    return html`<section>
      <div id="board-selector">
        <select
          ${ref(this.#selectorRef)}
          @input=${(evt: Event) => {
            if (!(evt.target instanceof HTMLSelectElement)) {
              return;
            }

            if (evt.target.value === "--custom--") {
              evt.stopImmediatePropagation();
              this.value = "";
              this.usingCustomURL = true;
              return;
            }

            this.value = evt.target.value;
            this.usingCustomURL = false;
          }}
        >
          <option value="">-- No Board</option>
          <option ?selected=${this.usingCustomURL} value="--custom--">
            -- Custom URL
          </option>
          ${this.subGraphs && Object.keys(this.subGraphs).length
            ? html`<optgroup label="Sub Boards">
                ${map(Object.entries(this.subGraphs), ([id, subGraph]) => {
                  const href = `#${id}`;
                  return html`<option
                    ?selected=${href === this.#board}
                    value=${href}
                  >
                    ${subGraph.title ?? "Untitled sub board"}
                  </option>`;
                })}
              </optgroup>`
            : nothing}
          ${map(boardServers, (provider) => {
            return html`${map(provider.items(), ([, store]) => {
              const storeItems = [...store.items]
                .filter(([, storeItem]) => {
                  return (storeItem.tags ?? []).includes("tool");
                })
                .sort(([, { title: titleA }], [, { title: titleB }]) => {
                  if (!titleA && titleB) return 1;
                  if (titleA && !titleB) return -1;
                  if (!titleA && !titleB) return 0;
                  if (titleA! > titleB!) return 1;
                  if (titleA! < titleB!) return -1;
                  return 0;
                });

              return html`<optgroup label="${store.title} boards">
                ${storeItems.length
                  ? map(storeItems, ([name, { url, title, username }]) => {
                      // TODO: Figure out whether URLs should be expanded here.
                      const expandedUrl = new URL(url, window.location.href);
                      return html`<option
                        ?selected=${expandedUrl.href === this.#board}
                        value=${expandedUrl.href}
                      >
                        ${title ?? name}${username ? ` (@${username})` : ""}
                      </option>`;
                    })
                  : html`<option disabled>
                      No tools available in this provider
                    </option>`}
              </optgroup>`;
            })}`;
          })}
        </select>
        ${showQuickSwitch
          ? html`<button
              id="quick-switch"
              @click=${() => {
                if (!this.#board) {
                  return;
                }

                const subGraphId = this.#board.replace(/^#/, "");
                this.dispatchEvent(new SubGraphChosenEvent(subGraphId));
              }}
            >
              Go
            </button>`
          : nothing}
      </div>
      ${this.usingCustomURL
        ? html`<input
            ${ref(this.#inputRef)}
            @input=${(evt: Event) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              if (!evt.target.checkValidity()) {
                evt.stopImmediatePropagation();
              }
            }}
            @blur=${(evt: Event) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              if (!evt.target.checkValidity()) {
                evt.target.reportValidity();
                evt.stopImmediatePropagation();
              }
            }}
            type="url"
            .value=${this.#board}
          />`
        : nothing}
    </section>`;
  }
}
