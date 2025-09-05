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
import { consume } from "@lit/context";
import {
  GlobalConfig,
  globalConfigContext,
} from "../../contexts/global-config";
import { getStepIcon } from "../../utils/get-step-icon";
import { icons } from "../../styles/icons";
import { colorsLight } from "../../styles/host/colors-light";
import { type } from "../../styles/host/type";
import { iconSubstitute } from "../../utils/icon-substitute";
import { repeat } from "lit/directives/repeat.js";

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
  accessor showParameters = false;

  @consume({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig | undefined;

  static styles = [
    icons,
    colorsLight,
    type,
    css`
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
        border-radius: var(--bb-grid-size-2);
        box-shadow: var(--bb-elevation-0);
        padding: var(--bb-grid-size-3) var(--bb-grid-size-3);
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
        background: var(--n-100);
        box-shadow: 0 0 0 12px var(--n-100);

        & input {
          width: 100%;
          height: var(--bb-grid-size-7);
          line-height: var(--bb-grid-size-7);
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          border-radius: var(--bb-grid-size-16);
          padding: 0 var(--bb-grid-size-2);
          border: 1px solid var(--n-60);
          outline: 1px solid var(--n-60);
          background: var(--n-95);
        }
      }

      #assets,
      #tools,
      #outputs,
      #parameters,
      section.integration {
        & h3 {
          font-size: 12px;
          color: var(--n-40);
          margin: 0 0 var(--bb-grid-size-3) 0;
        }

        & menu {
          display: block;
          width: 100%;
          padding: 0;
          margin: 0 0 var(--bb-grid-size-2) 0;
          list-style: none;

          & button {
            display: inline-flex;
            align-items: center;
            background-color: var(--background);
            border: none;
            border-radius: var(--bb-grid-size-2);
            color: var(--bb-neutral-900);
            margin: 0 0 var(--bb-grid-size-3) 0;
            height: var(--bb-grid-size-6);
            padding: 0 var(--bb-grid-size-2);
            max-width: 100%;
            font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
              var(--bb-font-family-mono);
            transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
            text-align: left;

            & .title {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              min-width: 0;
            }

            & .g-icon {
              margin-right: var(--bb-grid-size-2);
              flex: 0 0 auto;
              user-select: none;
              display: inline;
            }

            > * {
              pointer-events: none;
            }

            &:not([disabled]) {
              cursor: pointer;

              &.active,
              &:hover {
                outline: 1px solid var(--n-0);
              }
            }
          }

          & li:last-of-type button {
            margin-bottom: 0;
          }
        }

        &:last-of-type menu {
          margin-bottom: 0;
        }
      }

      #assets menu button {
        --background: var(--ui-asset);
      }

      #tools menu button {
        --background: var(--n-90);
      }

      #outputs menu button {
        &.generative,
        &[icon="spark"],
        &[icon="photo_spark"],
        &[icon="audio_magic_eraser"],
        &[icon="text_analysis"],
        &[icon="generative-image-edit"],
        &[icon="generative-code"],
        &[icon="videocam_auto"],
        &[icon="generative-search"],
        &[icon="generative"],
        &[icon="laps"] {
          --background: var(--ui-generate);
        }

        &.module {
          --background: var(--ui-generate);
        }

        &.input,
        &.output,
        &.core,
        &[icon="input"],
        &[icon="ask-user"],
        &[icon="chat_mirror"] {
          --background: var(--ui-get-input);
        }

        &[icon="output"],
        &[icon="docs"],
        &[icon="drive_presentation"],
        &[icon="sheets"],
        &[icon="code"],
        &[icon="web"],
        &[icon="responsive_layout"] {
          --background: var(--ui-display);
        }
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
      }
    `,
  ];

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

    window.removeEventListener("keydown", this.#onEscapeOrBackspaceBound, {
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

    const { globalConfig } = this;
    if (globalConfig?.environmentName) {
      tools = tools.filter((tool) => {
        if (tool.tags === undefined) {
          return true;
        }

        for (const tag of tool.tags) {
          if (
            tag.startsWith("environment") &&
            tag !== `environment-${globalConfig.environmentName}`
          ) {
            return false;
          }
        }

        return true;
      });
    }

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
        ${this.showAssets
          ? html`<h3 class="sans-flex w-400 round">Assets</h3>`
          : nothing}
        ${this.#items.assets.length
          ? html` <menu>
              ${this.#items.assets.map((asset) => {
                const classesDict: Record<string, boolean> = {
                  active: idx === this.selectedIndex,
                };

                const assetType = getAssetType(getMimeType(asset.data));
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
                    <span class="g-icon filled round">${assetType}</span>
                    <span class="title"
                      >${asset.metadata?.title ?? "Untitled asset"}</span
                    >
                  </button>
                </li>`;
              })}
            </menu>`
          : this.showAssets
            ? html`<div class="no-items">No assets</div>`
            : nothing}
      </section>

      <section id="parameters">
        ${this.showParameters
          ? html`<h3 class="sans-flex w-400 round">Parameters</h3>`
          : nothing}
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
                    <span class="title">${parameter.title}</span>
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
        ${this.showTools
          ? html`<h3 class="sans-flex w-400 round">Tools</h3>`
          : nothing}
        ${this.#items.tools.length
          ? html` <menu>
              ${this.#items.tools.map((tool) => {
                const active = idx === this.selectedIndex;
                const globalIndex = idx;
                const icon = iconSubstitute(tool.icon);
                idx++;
                return html`<li>
                  <button
                    class=${classMap({ active })}
                    icon=${icon}
                    @pointerover=${() => {
                      this.selectedIndex = globalIndex;
                    }}
                    @click=${() => {
                      this.#emitCurrentItem();
                    }}
                  >
                    <span class="g-icon round filled">${icon}</span
                    ><span class="title">${tool.title}</span>
                  </button>
                </li>`;
              })}
            </menu>`
          : this.showTools
            ? html`<div class="no-items">No tools</div>`
            : nothing}
      </section>

      <section id="outputs">
        ${this.showComponents
          ? html`<h3 class="sans-flex w-400 round">Steps</h3>`
          : nothing}
        ${this.#items.components.length
          ? html` <menu>
              ${this.#items.components.map((component) => {
                const icon = getStepIcon(
                  component.metadata?.icon,
                  component.ports
                );
                const active = idx === this.selectedIndex;
                const globalIndex = idx;
                idx++;
                return html`<li>
                  <button
                    icon=${icon}
                    class=${classMap({ active })}
                    @pointerover=${() => {
                      this.selectedIndex = globalIndex;
                    }}
                    @click=${() => {
                      this.#emitCurrentItem();
                    }}
                  >
                    <span class="g-icon filled round">${icon}</span>
                    <span class="title">${component.title}</span>
                  </button>
                </li>`;
              })}
            </menu>`
          : this.showComponents
            ? html`<div class="no-items">No components</div>`
            : nothing}
      </section>

      ${this.state
        ? repeat(
            this.state.integrations,
            ([url]) => url,
            ([_url, integration]) => {
              return html`<section class="integration">
                <h3 class="sans-flex w-400 round">${integration.title}</h3>
                <menu>${menu()}</menu>
              </section>`;

              function menu() {
                switch (integration.status) {
                  case "loading":
                    return html`<li>Loading...</li>`;
                  case "complete":
                    return html`
                      ${repeat(
                        integration.tools,
                        ([id]) => id,
                        ([_id, tool]) => {
                          return html`<li>
                            <button>${tool.title}</button>
                          </li>`;
                        }
                      )}
                    `;
                  case "error":
                    return html`<li>${integration.message}</li>`;
                }
              }
            }
          )
        : nothing}
    </div>`;
  }
}

function toUpperCase(s: string | null) {
  if (!s) return s;
  const trimmed = s.trim();
  const cap = trimmed.charAt(0).toLocaleUpperCase("en-US");
  return `${cap}${trimmed.slice(1)}`;
}
