/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Component, FastAccess, GraphAsset, Tool } from "../../state";
import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  FastAccessDismissedEvent,
  FastAccessSelectEvent,
} from "../../events/events";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";

@customElement("bb-fast-access-menu")
export class FastAccessMenu extends SignalWatcher(LitElement) {
  @property()
  accessor state: FastAccess | null = null;

  @property()
  accessor graphId: GraphIdentifier | null = null;

  @property()
  accessor nodeId: NodeIdentifier | null = null;

  @state()
  accessor selectedIndex = 0;

  @property()
  accessor filter: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 240px;
      background: var(--bb-neutral-0);
      height: 300px;
      overflow: scroll;
      scrollbar-width: none;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      box-shadow: var(--bb-elevation-5);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      white-space: normal;
      scroll-padding-top: var(--bb-grid-size-11);
      scroll-padding-bottom: var(--bb-grid-size-11);
    }

    .no-items {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-2);
    }

    header {
      margin-bottom: var(--bb-grid-size-2);
      position: sticky;
      top: 0;
      background: red;
      box-shadow: 0 0 0 8px var(--bb-neutral-0);

      & input {
        width: 100%;
        height: var(--bb-grid-size-7);
        line-height: var(--bb-grid-size-7);
        font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
          var(--bb-font-family);
        border-radius: var(--bb-grid-size);
        padding: 0 var(--bb-grid-size);
        border: 1px solid var(--bb-ui-700);
        outline: 1px solid var(--bb-ui-700);
      }
    }

    #assets,
    #tools,
    #outputs {
      & h3 {
        font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
          var(--bb-font-family);
        text-transform: uppercase;
        color: var(--bb-neutral-500);
        margin: 0 0 var(--bb-grid-size-2) 0;
      }

      & menu {
        display: block;
        width: 100%;
        padding: 0;
        margin: 0 0 var(--bb-grid-size-2) 0;
        list-style: none;

        & button {
          display: block;
          background-color: var(--bb-neutral-0);
          border: none;
          color: var(--bb-neutral-900);
          margin: var(--bb-grid-size-2) 0;
          height: var(--bb-grid-size-6);
          padding: 0 0 0 var(--bb-grid-size-7);
          width: 100%;
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          &:not([disabled]) {
            cursor: pointer;

            &.active,
            &:hover {
              background-color: var(--bb-neutral-100);
            }
          }
        }
      }
    }

    #assets menu button {
      background: var(--bb-icon-text) 4px center / 20px 20px no-repeat;
    }

    #tools menu button {
      background: var(--bb-icon-tool) 4px center / 20px 20px no-repeat;

      &.search {
        background-image: var(--bb-icon-search);
      }

      &.public {
        background-image: var(--bb-icon-public);
      }

      &.globe-book {
        background-image: var(--bb-icon-globe-book);
      }

      &.language {
        background-image: var(--bb-icon-language);
      }

      &.map-search {
        background-image: var(--bb-icon-map-search);
      }

      &.sunny {
        background-image: var(--bb-icon-sunny);
      }
    }

    #outputs menu button {
      background: var(--bb-icon-output) 4px center / 20px 20px no-repeat;
    }
  `;

  #itemContainerRef: Ref<HTMLDivElement> = createRef();
  #filterInputRef: Ref<HTMLInputElement> = createRef();
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onEscapeOrBackspaceBound = this.#onEscapeOrBackspace.bind(this);

  #items: {
    assets: GraphAsset[];
    tools: Tool[];
    components: Component[];
  } = { assets: [], tools: [], components: [] };

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#onEscapeOrBackspaceBound, {
      capture: true,
    });
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.addEventListener("keydown", this.#onEscapeOrBackspaceBound, {
      capture: true,
    });
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  protected willUpdate(): void {
    const graphId = this.graphId || "";
    let assets = [...(this.state?.graphAssets.values() || [])];
    let tools = [
      ...(this.state?.tools.values() || []),
      ...(this.state?.myTools.values() || []),
    ].sort((tool1, tool2) => tool1.order! - tool2.order!);
    let components = [...(this.state?.components.get(graphId)?.values() || [])];

    if (this.filter) {
      const filterStr = this.filter;

      assets = assets.filter((asset) => {
        const filter = new RegExp(filterStr, "gim");
        return filter.test(asset.metadata?.title ?? asset.path);
      });

      tools = tools.filter((tool) => {
        const filter = new RegExp(filterStr, "gim");
        return filter.test(tool.title ?? "");
      });

      components = components.filter((component) => {
        const filter = new RegExp(filterStr, "gim");
        return filter.test(component.title);
      });
    }

    this.#items = {
      assets,
      tools,
      components,
    };

    const totalSize =
      this.#items.assets.length +
      this.#items.tools.length +
      this.#items.components.length;

    this.selectedIndex = this.#clamp(this.selectedIndex, 0, totalSize - 1);
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    if (!this.#filterInputRef.value) {
      return;
    }

    this.#filterInputRef.value.select();
  }

  updated() {
    if (!this.#itemContainerRef.value) {
      return;
    }

    const button = this.#itemContainerRef.value.querySelector("button.active");
    if (!button) {
      return;
    }

    button.scrollIntoView({ block: "nearest" });
  }

  #onEscapeOrBackspace(evt: KeyboardEvent): void {
    if (!this.classList.contains("active")) {
      return;
    }

    const maybeClose =
      evt.key === "Escape" || evt.key === "Backspace" || evt.key === "Delete";
    if (!maybeClose) {
      return;
    }

    // In the case of Backspace/Delete we need to make sure the filter is empty
    // before we close the Fast Access Menu.
    if (evt.key !== "Escape") {
      if (this.filter !== null && this.filter !== "") {
        return;
      }
    }

    this.dispatchEvent(new FastAccessDismissedEvent());
    evt.stopImmediatePropagation();
  }

  #onKeyDown(evt: KeyboardEvent): void {
    if (!this.classList.contains("active")) {
      return;
    }

    const totalSize =
      this.#items.assets.length +
      this.#items.tools.length +
      this.#items.components.length;

    switch (evt.key) {
      case "Enter": {
        evt.stopImmediatePropagation();
        evt.preventDefault();
        this.#emitCurrentItem();
        break;
      }

      case "ArrowUp": {
        this.selectedIndex = this.#clamp(
          this.selectedIndex - 1,
          0,
          totalSize - 1
        );
        break;
      }

      case "Tab":
      case "ArrowDown": {
        evt.preventDefault();

        this.selectedIndex = this.#clamp(
          this.selectedIndex + 1,
          0,
          totalSize - 1
        );
        break;
      }
    }
  }

  #clamp(value: number, min: number, max: number) {
    if (value < min) {
      value = min;
    }

    if (value > max) {
      value = max;
    }

    return value;
  }

  #emitCurrentItem() {
    let idx = this.selectedIndex;
    if (idx < this.#items.assets.length) {
      const asset = this.#items.assets[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(
          asset.path,
          asset.metadata?.title ?? "Untitled asset",
          "asset"
        )
      );
      return;
    }

    idx -= this.#items.assets.length;
    if (idx < this.#items.tools.length) {
      const tool = this.#items.tools[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(
          tool.url,
          tool.title ?? "Untitled tool",
          "tool"
        )
      );
      return;
    }

    idx -= this.#items.tools.length;
    if (idx < this.#items.components.length) {
      const component = this.#items.components[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(component.id, component.title, "in")
      );
      return;
    }
    console.warn("Index out of bounds for fast access selection");
  }

  focusFilter() {
    if (!this.#filterInputRef.value) {
      return;
    }

    this.#filterInputRef.value.select();
  }

  render() {
    let idx = 0;
    return html` <div ${ref(this.#itemContainerRef)}>
      <header>
        <input
          autofocus
          type="text"
          .placeholder=${"Search"}
          ${ref(this.#filterInputRef)}
          .value=${this.filter}
          @input=${(evt: InputEvent) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.filter = evt.target.value;
          }}
        />
      </header>
      <section id="assets">
        <h3>Assets</h3>
        ${this.#items.assets.length
          ? html` <menu>
              ${this.#items.assets.map((asset) => {
                const active = idx === this.selectedIndex;
                const globalIndex = idx;
                idx++;
                return html`<li>
                  <button
                    class=${classMap({ active })}
                    @pointerover=${() => {
                      this.selectedIndex = globalIndex;
                    }}
                    @click=${() => {
                      this.#emitCurrentItem();
                    }}
                  >
                    ${asset.metadata?.title}
                  </button>
                </li>`;
              })}
            </menu>`
          : html`<div class="no-items">No assets</div>`}
      </section>

      <section id="tools">
        <h3>Tools</h3>
        ${this.#items.tools.length
          ? html` <menu>
              ${this.#items.tools.map((tool) => {
                const active = idx === this.selectedIndex;
                const icon = tool.icon ? { [tool.icon]: true } : {};
                const globalIndex = idx;
                idx++;
                return html`<li>
                  <button
                    class=${classMap({ active, ...icon })}
                    @pointerover=${() => {
                      this.selectedIndex = globalIndex;
                    }}
                    @click=${() => {
                      this.#emitCurrentItem();
                    }}
                  >
                    ${tool.title}
                  </button>
                </li>`;
              })}
            </menu>`
          : html`<div class="no-items">No tools</div>`}
      </section>

      <section id="outputs">
        <h3>Flow output from</h3>
        ${this.#items.components.length
          ? html` <menu>
              ${this.#items.components.map((component) => {
                const active = idx === this.selectedIndex;
                const globalIndex = idx;
                idx++;
                return html`<li>
                  <button
                    class=${classMap({ active })}
                    @pointerover=${() => {
                      this.selectedIndex = globalIndex;
                    }}
                    @click=${() => {
                      this.#emitCurrentItem();
                    }}
                  >
                    ${component.title}
                  </button>
                </li>`;
              })}
            </menu>`
          : html`<div class="no-items">No components</div>`}
      </section>
    </div>`;
  }
}
