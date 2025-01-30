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
import { css, html, LitElement } from "lit";
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

  static styles = css`
    :host {
      display: block;
      width: 240px;
      background: var(--bb-neutral-0);
      height: 300px;
      overflow: scroll;
      scrollbar-width: none;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size-2);
      box-shadow: var(--bb-elevation-6);
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      white-space: normal;
    }

    .no-items {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-2);
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
          display: flex;
          align-items: center;
          justify-content: flex-start;
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
    }

    #outputs menu button {
      background: var(--bb-icon-output) 4px center / 20px 20px no-repeat;
    }
  `;

  #itemContainerRef: Ref<HTMLDivElement> = createRef();
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onEscapeBound = this.#onEscape.bind(this);

  #items: {
    assets: GraphAsset[];
    tools: Tool[];
    components: Component[];
  } = { assets: [], tools: [], components: [] };

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("keydown", this.#onEscapeBound, { capture: true });
    window.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    window.addEventListener("keydown", this.#onEscapeBound, { capture: true });
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  protected willUpdate(): void {
    const graphId = this.graphId || "";
    const assets = [...(this.state?.graphAssets.values() || [])];
    const tools = [...(this.state?.tools.values() || [])];
    const components = [
      ...(this.state?.components.get(graphId)?.values() || []),
    ];

    this.#items = {
      assets,
      tools,
      components,
    };
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

  #onEscape(evt: KeyboardEvent): void {
    if (!this.classList.contains("active")) {
      return;
    }

    if (evt.key !== "Escape") {
      return;
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
    if (idx < this.#items.tools.length) {
      const component = this.#items.components[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(component.id, component.title, "in")
      );
      return;
    }
    console.warn("Index out of bounds for fast access selection");
  }

  render() {
    const graphId = this.graphId || "";
    const assets = [...(this.state?.graphAssets.values() || [])];
    const tools = [...(this.state?.tools.values() || [])];
    const components = [
      ...(this.state?.components.get(graphId)?.values() || []),
    ];
    let idx = 0;
    return html` <div ${ref(this.#itemContainerRef)}>
      <section id="assets">
        <h3>Assets</h3>
        ${assets.length
          ? html` <menu>
              ${assets.map((asset) => {
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
        ${tools.length
          ? html` <menu>
              ${tools.map((tool) => {
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
                    ${tool.title}
                  </button>
                </li>`;
              })}
            </menu>`
          : html`<div class="no-items">No tools</div>`}
      </section>

      <section id="outputs">
        <h3>Flow output from</h3>
        ${components.length
          ? html` <menu>
              ${components.map((component) => {
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
