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
import { css, html, LitElement, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Component, FastAccess, GraphAsset, Tool } from "../../state";
import {
  GraphIdentifier,
  NodeIdentifier,
  ParameterMetadata,
} from "@breadboard-ai/types";
import {
  FastAccessDismissedEvent,
  FastAccessSelectEvent,
  ParamCreateEvent,
} from "../../events/events";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { getAssetType, getMimeType } from "../../utils/mime-type";

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

  @property()
  accessor showAssets = true;

  @property()
  accessor showTools = true;

  @property()
  accessor showComponents = true;

  @property()
  accessor showParameters = true;

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
    #outputs,
    #parameters {
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
          border-radius: var(--bb-grid-size);
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

    #assets menu button.audio {
      background-image: var(--bb-icon-sound);
    }

    #assets menu button.image {
      background-image: var(--bb-icon-add-image);
    }

    #assets menu button.text {
      background-image: var(--bb-icon-text);
    }

    #assets menu button.video {
      background-image: var(--bb-icon-add-video);
    }

    #parameters {
      & #create-new-param {
        display: block;
        white-space: nowrap;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        border-radius: var(--bb-grid-size-16);
        height: var(--bb-grid-size-7);
        border: none;
        background: var(--bb-icon-add) var(--bb-neutral-100) 4px center / 20px
          20px no-repeat;
        padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-8);
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        margin-top: var(--bb-grid-size-2);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background-color: var(--bb-neutral-200);
          }
        }
      }

      & menu button {
        background: var(--bb-icon-contact-support) 4px center / 20px 20px
          no-repeat;
      }
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
    parameters: (ParameterMetadata & { id: string })[];
  } = { assets: [], tools: [], components: [], parameters: [] };

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
    let assets = [...(this.state?.graphAssets.values() || [])].filter(
      (asset) =>
        !asset.connector ||
        asset.connector.type.load ||
        asset.connector.type.save
    );
    let tools = [
      ...(this.state?.tools.values() || []),
      ...(this.state?.myTools.values() || []),
    ].sort((tool1, tool2) => tool1.order! - tool2.order!);
    let components = [...(this.state?.components.get(graphId)?.values() || [])];
    let parameters = [...(this.state?.parameters.entries() || [])].map(
      ([id, value]) => ({ id, ...value })
    );

    if (this.filter) {
      const filterStr = this.filter;

      assets = assets.filter((asset) => {
        if (asset.path === "@@splash") {
          return false;
        }

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

      parameters = parameters.filter((parameter) => {
        const filter = new RegExp(filterStr, "gim");
        return filter.test(parameter.title);
      });
    }

    this.#items = {
      assets: this.showAssets ? assets : [],
      tools: this.showTools ? tools : [],
      components: this.showComponents ? components : [],
      parameters: this.showParameters ? parameters : [],
    };

    const totalSize =
      this.#items.assets.length +
      this.#items.tools.length +
      this.#items.components.length +
      this.#items.parameters.length;

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
      this.#items.parameters.length +
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
    const uniqueAndNew =
      this.#items.assets.length === 0 &&
      this.#items.components.length === 0 &&
      this.#items.parameters.length === 0 &&
      this.#items.tools.length === 0 &&
      this.filter !== "";

    if (idx === -1) {
      if (this.filter && uniqueAndNew && this.showParameters) {
        // emit.
        const paramPath = this.filter.toLocaleLowerCase().replace(/\W/gim, "-");
        const title = toUpperCase(this.filter)!;
        this.dispatchEvent(
          // TODO: Support params in subgraphs.
          new ParamCreateEvent("", paramPath, title, "")
        );

        this.dispatchEvent(
          new FastAccessSelectEvent(paramPath, title, "param")
        );
      }
      return;
    }

    if (idx < this.#items.assets.length) {
      const asset = this.#items.assets[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(
          asset.path,
          asset.metadata?.title ?? "Untitled asset",
          "asset",
          getMimeType(asset.data)
        )
      );
      return;
    }

    idx -= this.#items.assets.length;
    if (idx < this.#items.parameters.length) {
      const parameter = this.#items.parameters[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(
          parameter.id,
          parameter.title ?? "Untitled parameter",
          "param"
        )
      );
      return;
    }

    idx -= this.#items.parameters.length;
    if (idx < this.#items.tools.length) {
      const tool = this.#items.tools[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(
          tool.url,
          tool.title ?? "Untitled tool",
          "tool",
          undefined,
          tool.connectorInstance
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
    const uniqueAndNew =
      this.#items.assets.length === 0 &&
      this.#items.components.length === 0 &&
      this.#items.parameters.length === 0 &&
      this.#items.tools.length === 0 &&
      this.filter !== "" &&
      this.showParameters;

    return html` <div ${ref(this.#itemContainerRef)}>
      <header>
        <input
          autofocus
          type="text"
          .placeholder=${"Search"}
          ${ref(this.#filterInputRef)}
          .value=${this.filter}
          @keydown=${(evt: KeyboardEvent) => {
            const isMac = navigator.platform.indexOf("Mac") === 0;
            const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

            if (isCtrlCommand && evt.key === "Enter") {
              evt.stopImmediatePropagation();

              this.selectedIndex = -1;
              this.#emitCurrentItem();
            }
          }}
          @input=${(evt: InputEvent) => {
            if (!(evt.target instanceof HTMLInputElement)) {
              return;
            }

            this.filter = evt.target.value;
          }}
        />
      </header>
      <section id="assets">
        ${this.showAssets ? html`<h3>Assets</h3>` : nothing}
        ${this.#items.assets.length
          ? html` <menu>
              ${this.#items.assets.map((asset) => {
                const classesDict: Record<string, boolean> = {
                  active: idx === this.selectedIndex,
                };

                const assetType = getAssetType(getMimeType(asset.data));
                if (assetType) {
                  classesDict[assetType] = true;
                }
                const globalIndex = idx;
                idx++;
                return html`<li>
                  <button
                    class=${classMap(classesDict)}
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
          : this.showAssets
            ? html`<div class="no-items">No assets</div>`
            : nothing}
      </section>

      <section id="parameters">
        ${this.showParameters ? html`<h3>Parameters</h3>` : nothing}
        ${this.#items.parameters.length
          ? html` <menu>
              ${this.#items.parameters.map((parameter) => {
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
                    ${parameter.title}
                  </button>
                </li>`;
              })}
            </menu>`
          : this.showParameters
            ? html`<div class="no-items">
                No parameters
                ${uniqueAndNew
                  ? html`<button
                      id="create-new-param"
                      @click=${() => {
                        this.#emitCurrentItem();
                      }}
                    >
                      Add "${toUpperCase(this.filter)}"
                    </button>`
                  : nothing}
              </div>`
            : nothing}
      </section>

      <section id="tools">
        ${this.showTools ? html`<h3>Tools</h3>` : nothing}
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
          : this.showTools
            ? html`<div class="no-items">No tools</div>`
            : nothing}
      </section>

      <section id="outputs">
        ${this.showComponents ? html`<h3>Flow output from</h3>` : nothing}
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
          : this.showComponents
            ? html`<div class="no-items">No components</div>`
            : nothing}
      </section>
    </div>`;
  }
}

function toUpperCase(s: string | null) {
  if (!s) return s;
  const trimmed = s.trim();
  const cap = trimmed.charAt(0).toLocaleUpperCase("en-US");
  return `${cap}${trimmed.slice(1)}`;
}
