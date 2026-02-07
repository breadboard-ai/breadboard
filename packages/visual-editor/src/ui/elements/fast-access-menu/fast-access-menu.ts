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
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Component, FastAccess, GraphAsset, Tool } from "../../state/index.js";
import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  FastAccessDismissedEvent,
  FastAccessSelectEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { getAssetType, getMimeType } from "../../utils/mime-type.js";
import { consume } from "@lit/context";
import {
  GlobalConfig,
  globalConfigContext,
} from "../../contexts/global-config.js";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import { getStepIcon } from "../../utils/get-step-icon.js";
import { iconSubstitute } from "../../utils/icon-substitute.js";
import { repeat } from "lit/directives/repeat.js";
import * as Styles from "../../styles/styles.js";
import { ROUTE_TOOL_PATH } from "../../../a2/a2/tool-manager.js";

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
  accessor showAgentModeTools = true;

  @property()
  accessor showRoutes = false;

  @property()
  accessor showComponents = true;

  @consume({ context: globalConfigContext })
  accessor globalConfig: GlobalConfig | undefined;

  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    Styles.HostIcons.icons,
    Styles.HostColorsBase.baseColors,
    Styles.HostType.type,
    Styles.HostColorScheme.match,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 240px;
        background: light-dark(var(--n-100), var(--n-20));
        height: 300px;
        overflow: scroll;
        scrollbar-width: none;
        border-radius: var(--bb-grid-size-2);
        box-shadow: 0px 0 20px rgb(0, 0, 0, 0.1);
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
        background: light-dark(var(--n-100), var(--n-20));
        box-shadow: 0 0 0 12px light-dark(var(--n-100), var(--n-20));

        & input {
          width: 100%;
          height: var(--bb-grid-size-7);
          line-height: var(--bb-grid-size-7);
          font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
            var(--bb-font-family);
          border-radius: var(--bb-grid-size-16);
          padding: 0 var(--bb-grid-size-2);
          border: 1px solid var(--light-dark-n-60);
          outline: 1px solid var(--light-dark-n-60);
          background: var(--light-dark-n-95);
        }
      }

      #assets,
      #tools,
      #outputs,
      section.group {
        & h3 {
          font-size: 12px;
          color: var(--light-dark-n-40);
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
            color: var(--n-10);
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

            & .route {
              margin-right: var(--bb-grid-size-2);
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
                outline: 1px solid var(--light-dark-n-0);
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

      section.tools menu button {
        --background: var(--n-90);

        &.generative,
        &[icon="spark"],
        &[icon="photo_spark"],
        &[icon="audio_magic_eraser"],
        &[icon="text_analysis"],
        &[icon="button_magic"],
        &[icon="generative-image-edit"],
        &[icon="generative-code"],
        &[icon="videocam_auto"],
        &[icon="generative-search"],
        &[icon="generative"],
        &[icon="select_all"],
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

      #outputs menu button {
        &.generative,
        &[icon="spark"],
        &[icon="photo_spark"],
        &[icon="audio_magic_eraser"],
        &[icon="text_analysis"],
        &[icon="button_magic"],
        &[icon="generative-image-edit"],
        &[icon="generative-code"],
        &[icon="videocam_auto"],
        &[icon="generative-search"],
        &[icon="generative"],
        &[icon="select_all"],
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

      .integration menu button {
        --background: var(--n-90);
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

    window.removeEventListener("keydown", this.#onEscapeOrBackspaceBound, {
      capture: true,
    });
    window.removeEventListener("keydown", this.#onKeyDownBound);
  }

  protected willUpdate(): void {
    const graphId = this.graphId || "";
    let assets = [...(this.state?.graphAssets.values() || [])];
    let tools = [
      ...(this.sca?.controller.editor.graph.tools.values() || []),
      ...(this.state?.myTools.values() || []),
    ].sort((tool1, tool2) => tool1.order! - tool2.order!);
    let components = [...(this.state?.components.get(graphId)?.values() || [])];

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
    }

    // Append agentMode tools (routing, memory) to the end of tools
    if (this.showAgentModeTools && this.state?.agentMode.results) {
      for (const [id, tool] of this.state.agentMode.results) {
        // Apply filter if present
        if (this.filter) {
          const filterRe = new RegExp(this.filter, "gim");
          if (!filterRe.test(tool.title ?? "")) {
            continue;
          }
        }
        tools.push({ ...tool, url: id });
      }
    }

    this.#items = {
      assets: this.showAssets ? assets : [],
      tools: this.showTools ? tools : [],
      components: this.showComponents ? components : [],
    };

    const totalSize =
      this.#items.assets.length +
      this.#items.tools.length +
      this.#items.components.length +
      (this.state?.routes.results.size ?? 0);

    this.selectedIndex = this.#clamp(this.selectedIndex, 0, totalSize - 1);
  }

  protected firstUpdated(): void {
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

  updateFilter(filter: string) {
    this.filter = filter;
    if (!this.state) {
      return;
    }

    this.state.integrations.filter = filter;
    this.state.agentMode.filter = filter;
    this.state.routes.filter = filter;
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
      this.#items.components.length +
      (this.state?.routes.results.size ?? 0);

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

    if (idx === -1) {
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
    if (idx < this.#items.tools.length) {
      const tool = this.#items.tools[idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(
          tool.url,
          tool.title ?? "Untitled tool",
          "tool",
          undefined,
          tool.id
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

    const routeSize = this.state?.routes.results.size ?? 0;
    idx -= this.#items.components.length;
    if (idx < routeSize) {
      const [, route] = [...this.state!.routes.results][idx];
      this.dispatchEvent(
        new FastAccessSelectEvent(
          ROUTE_TOOL_PATH,
          route.title!,
          "tool",
          undefined,
          route.id
        )
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
          type="text"
          autocomplete="off"
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

            this.updateFilter(evt.target.value);
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

                let icon = getAssetType(getMimeType(asset.data));
                if (!icon) {
                  icon = "text_fields";
                  if (asset.metadata?.type === "file") {
                    icon = "upload";
                  }
                }

                // Override icon based on subType (e.g., youtube, drawable, gdrive)
                if (asset.metadata?.subType) {
                  switch (asset.metadata?.subType) {
                    case "youtube":
                      icon = "video_youtube";
                      break;
                    case "drawable":
                      icon = "draw";
                      break;
                    case "gdrive":
                      icon = "drive";
                      break;
                  }
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
                    <span class="g-icon filled round">${icon}</span>
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

      <section id="tools">
        ${this.showTools
          ? html`<h3 class="sans-flex w-400 round">Tools</h3>`
          : nothing}
        ${this.#items.tools.length
          ? html` <menu>
              ${this.#items.tools.map((tool) => {
                const active = idx === this.selectedIndex;
                const globalIndex = idx;
                // Special handling for routing and memory tool icons
                let icon: string | HTMLTemplateResult | null | undefined;
                if (tool.url === "control-flow/routing") {
                  icon = "start";
                } else if (tool.url === "function-group/use-memory") {
                  icon = "database";
                } else if (typeof tool.icon === "string") {
                  icon = iconSubstitute(tool.icon) ?? undefined;
                } else {
                  icon = tool.icon;
                }
                idx++;
                return html`<li>
                  <button
                    class=${classMap({ active })}
                    icon=${typeof icon === "string" ? icon : "tool"}
                    @pointerover=${() => {
                      this.selectedIndex = globalIndex;
                    }}
                    @click=${() => {
                      this.#emitCurrentItem();
                    }}
                  >
                    <span class="g-icon round filled">${icon}</span
                    ><span class="title"
                      >${tool.title}${tool.url === "control-flow/routing"
                        ? html`...`
                        : nothing}</span
                    >
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
            ? html`<div class="no-items">No steps</div>`
            : nothing}
      </section>

      <section class="group tools">
        ${this.showRoutes
          ? html`<h3 class="sans-flex w-400 round">Steps</h3>
              ${this.state?.routes.results.size
                ? html`<menu>
                    ${repeat(
                      this.state.routes.results,
                      ([id]) => id,
                      ([_, route]) => {
                        const active = idx === this.selectedIndex;
                        const globalIndex = idx;
                        idx++;
                        const icon = iconSubstitute(route.metadata?.icon);

                        return html`<li>
                          <button
                            icon=${icon}
                            class=${classMap({ active })}
                            @pointerover=${() => {
                              this.selectedIndex = globalIndex;
                            }}
                            @click=${() => {
                              this.dispatchEvent(
                                new FastAccessSelectEvent(
                                  route.id,
                                  route.title!,
                                  "tool",
                                  undefined,
                                  route.id
                                )
                              );
                            }}
                          >
                            <span class="g-icon filled round">${icon}</span>
                            <span class="title">${route.title}</span>
                          </button>
                        </li>`;
                      }
                    )}
                  </menu>`
                : html`<div class="no-items">No routes</div>`}`
          : nothing}
      </section>

      ${this.state
        ? repeat(
            this.state.integrations.results,
            ([url]) => url,
            ([url, integration]) => {
              const menu = () => {
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
                            <button
                              @click=${() => {
                                this.dispatchEvent(
                                  new FastAccessSelectEvent(
                                    url,
                                    tool.title!,
                                    "tool",
                                    undefined,
                                    tool.id
                                  )
                                );
                              }}
                              icon=${tool.icon}
                            >
                              <span class="g-icon filled round"
                                >${tool.icon}</span
                              >
                              <span class="title">${tool.title}</span>
                            </button>
                          </li>`;
                        }
                      )}
                    `;
                  case "error":
                    return html`<li>No integrations are available</li>`;
                }
              };
              return html`<section class="group">
                <h3 class="sans-flex w-400 round">${integration.title}</h3>
                <menu>${menu()}</menu>
              </section>`;
            }
          )
        : nothing}
    </div>`;
  }
}
