/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { SignalWatcher } from "@lit-labs/signals";
import { css, html, HTMLTemplateResult, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Component, Tool } from "../../../sca/types.js";
import type { GraphAsset } from "../../../sca/types.js";
import {
  FastAccessDismissedEvent,
  FastAccessSelectEvent,
} from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { getAssetType, getMimeType } from "../../../utils/media/mime-type.js";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import type { SCA } from "../../../sca/sca.js";
import { getStepIcon } from "../../utils/get-step-icon.js";
import { iconSubstitute } from "../../utils/icon-substitute.js";
import { repeat } from "lit/directives/repeat.js";
import * as Styles from "../../styles/styles.js";

import type { DisplayItem } from "../../../sca/types.js";

@customElement("bb-fast-access-menu")
export class FastAccessMenu extends SignalWatcher(LitElement) {
  @state()
  accessor selectedIndex = 0;

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

  /**
   * Unified flat list of all displayable items. Built in willUpdate()
   * from SCA data + legacy integrations. Eliminates the brittle
   * index-offset arithmetic that was previously spread across
   * render(), #emitCurrentItem(), and #onKeyDown().
   */
  #items: DisplayItem[] = [];

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
    // Use the first selected node for routes/components filtering.
    // We can't use selectedNodeId because it returns null when edges or
    // assets are also selected (common when a node has connections).
    const selectedNodes = this.sca?.controller.editor.selection.selection.nodes;
    const selectedNodeId: string | null =
      selectedNodes?.size === 1 ? [...selectedNodes][0] : null;
    const graphController = this.sca?.controller.editor.graph;
    const fastAccessController = this.sca?.controller.editor.fastAccess;

    if (!graphController || !fastAccessController) {
      this.#items = [];
      return;
    }

    // Get the flat items from GraphController
    const rawItems = graphController.getFastAccessItems(selectedNodeId);

    // Delegate all filtering to FastAccessController
    const items = fastAccessController.getDisplayItems(
      rawItems,
      graphController.agentModeTools,
      {
        environmentName: this.sca?.services.globalConfig?.environmentName,
        enableNotebookLm:
          this.sca?.controller.global.flags.enableNotebookLm ?? false,
        integrationsController:
          this.sca?.controller.editor.integrations ?? null,
      }
    );

    this.#items = items;
    this.selectedIndex = this.#clamp(
      this.selectedIndex,
      0,
      this.#items.length - 1
    );
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
    if (this.sca) {
      this.sca.controller.editor.fastAccess.filter = filter;
    }
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
      if (this.sca?.controller.editor.fastAccess.filter) {
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
          this.#items.length - 1
        );
        break;
      }

      case "Tab":
      case "ArrowDown": {
        evt.preventDefault();

        this.selectedIndex = this.#clamp(
          this.selectedIndex + 1,
          0,
          this.#items.length - 1
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

  /**
   * Emits a selection event for the currently highlighted item.
   * Uses a simple array lookup + switch on item kind — no manual
   * subtraction through section lengths.
   */
  #emitCurrentItem() {
    const item = this.#items[this.selectedIndex];
    if (!item) {
      return;
    }

    switch (item.kind) {
      case "asset":
        this.dispatchEvent(
          new FastAccessSelectEvent(
            item.asset.path,
            item.asset.metadata?.title ?? "Untitled asset",
            "asset",
            getMimeType(item.asset.data)
          )
        );
        break;

      case "tool":
        this.dispatchEvent(
          new FastAccessSelectEvent(
            item.tool.url,
            item.tool.title ?? "Untitled tool",
            "tool",
            undefined,
            item.tool.id
          )
        );
        break;

      case "component":
        this.dispatchEvent(
          new FastAccessSelectEvent(
            item.component.id,
            item.component.title,
            "in"
          )
        );
        break;

      case "route":
        this.dispatchEvent(
          new FastAccessSelectEvent(
            item.route.id,
            item.route.title,
            "tool",
            undefined,
            item.route.id
          )
        );
        break;

      case "integration-tool":
        this.dispatchEvent(
          new FastAccessSelectEvent(
            item.url,
            item.tool.title!,
            "tool",
            undefined,
            item.tool.id
          )
        );
        break;
    }
  }

  focusFilter() {
    if (!this.#filterInputRef.value) {
      return;
    }

    this.#filterInputRef.value.select();
  }

  // =========================================================================
  // Rendering Helpers
  // =========================================================================

  /**
   * Collects items of a given kind from the flat list, preserving their
   * global indices for active-state tracking.
   */
  #itemsOfKind<K extends DisplayItem["kind"]>(
    kind: K
  ): { item: Extract<DisplayItem, { kind: K }>; globalIndex: number }[] {
    const result: {
      item: Extract<DisplayItem, { kind: K }>;
      globalIndex: number;
    }[] = [];
    for (let i = 0; i < this.#items.length; i++) {
      const entry = this.#items[i];
      if (entry.kind === kind) {
        result.push({
          item: entry as Extract<DisplayItem, { kind: K }>,
          globalIndex: i,
        });
      }
    }
    return result;
  }

  #renderAssetButton(
    asset: GraphAsset,
    globalIndex: number
  ): HTMLTemplateResult {
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

    return html`<li>
      <button
        class=${classMap({ active: globalIndex === this.selectedIndex })}
        @pointerover=${() => {
          this.selectedIndex = globalIndex;
        }}
        @click=${() => {
          this.#emitCurrentItem();
        }}
      >
        <span class="g-icon filled round">${icon}</span>
        <span class="title">${asset.metadata?.title ?? "Untitled asset"}</span>
      </button>
    </li>`;
  }

  #renderToolButton(tool: Tool, globalIndex: number): HTMLTemplateResult {
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

    return html`<li>
      <button
        class=${classMap({ active: globalIndex === this.selectedIndex })}
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
  }

  #renderComponentButton(
    component: Component,
    globalIndex: number
  ): HTMLTemplateResult {
    const icon = getStepIcon(component.metadata?.icon, component.ports);

    return html`<li>
      <button
        icon=${icon}
        class=${classMap({ active: globalIndex === this.selectedIndex })}
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
  }

  #renderRouteButton(
    route: Component,
    globalIndex: number
  ): HTMLTemplateResult {
    const icon = iconSubstitute(route.metadata?.icon);

    return html`<li>
      <button
        icon=${icon}
        class=${classMap({ active: globalIndex === this.selectedIndex })}
        @pointerover=${() => {
          this.selectedIndex = globalIndex;
        }}
        @click=${() => {
          this.#emitCurrentItem();
        }}
      >
        <span class="g-icon filled round">${icon}</span>
        <span class="title">${route.title}</span>
      </button>
    </li>`;
  }

  render() {
    const mode = this.sca?.controller.editor.fastAccess.fastAccessMode;
    const showAssets = mode === "browse";
    const showTools = mode !== "route";
    const showComponents = mode !== "route";
    const showRoutes = mode === "route";

    const assets = this.#itemsOfKind("asset");
    const tools = this.#itemsOfKind("tool");
    const components = this.#itemsOfKind("component");
    const routes = this.#itemsOfKind("route");
    const integrationTools = this.#itemsOfKind("integration-tool");

    // Group integration tools by URL for section headers
    const integrationsByUrl = new Map<
      string,
      { title: string; items: { tool: Tool; globalIndex: number }[] }
    >();
    for (const { item, globalIndex } of integrationTools) {
      let group = integrationsByUrl.get(item.url);
      if (!group) {
        // Use the integration title from registered integrations
        const integration =
          this.sca?.controller.editor.integrations.registered.get(item.url);
        group = {
          title: integration?.title ?? item.url,
          items: [],
        };
        integrationsByUrl.set(item.url, group);
      }
      group.items.push({ tool: item.tool, globalIndex });
    }

    return html` <div ${ref(this.#itemContainerRef)}>
      <header>
        <input
          type="text"
          autocomplete="off"
          .placeholder=${"Search"}
          ${ref(this.#filterInputRef)}
          .value=${this.sca?.controller.editor.fastAccess.filter ?? ""}
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
        ${showAssets
          ? html`<h3 class="sans-flex w-400 round">Assets</h3>`
          : nothing}
        ${assets.length
          ? html` <menu>
              ${assets.map(({ item, globalIndex }) =>
                this.#renderAssetButton(item.asset, globalIndex)
              )}
            </menu>`
          : showAssets
            ? html`<div class="no-items">No assets</div>`
            : nothing}
      </section>

      <section id="tools">
        ${showTools
          ? html`<h3 class="sans-flex w-400 round">Tools</h3>`
          : nothing}
        ${tools.length
          ? html` <menu>
              ${tools.map(({ item, globalIndex }) =>
                this.#renderToolButton(item.tool, globalIndex)
              )}
            </menu>`
          : showTools
            ? html`<div class="no-items">No tools</div>`
            : nothing}
      </section>

      <section id="outputs">
        ${showComponents
          ? html`<h3 class="sans-flex w-400 round">Steps</h3>`
          : nothing}
        ${components.length
          ? html` <menu>
              ${components.map(({ item, globalIndex }) =>
                this.#renderComponentButton(item.component, globalIndex)
              )}
            </menu>`
          : showComponents
            ? html`<div class="no-items">No steps</div>`
            : nothing}
      </section>

      <section class="group tools">
        ${showRoutes
          ? html`<h3 class="sans-flex w-400 round">Steps</h3>
              ${routes.length
                ? html`<menu>
                    ${routes.map(({ item, globalIndex }) =>
                      this.#renderRouteButton(item.route, globalIndex)
                    )}
                  </menu>`
                : html`<div class="no-items">No routes</div>`}`
          : nothing}
      </section>

      ${repeat(
        integrationsByUrl,
        ([url]) => url,
        ([, group]) => {
          return html`<section class="group">
            <h3 class="sans-flex w-400 round">${group.title}</h3>
            <menu>
              ${group.items.map(
                ({ tool, globalIndex }) =>
                  html`<li>
                    <button
                      class=${classMap({
                        active: globalIndex === this.selectedIndex,
                      })}
                      @pointerover=${() => {
                        this.selectedIndex = globalIndex;
                      }}
                      @click=${() => {
                        this.#emitCurrentItem();
                      }}
                      icon=${tool.icon}
                    >
                      <span class="g-icon filled round">${tool.icon}</span>
                      <span class="title">${tool.title}</span>
                    </button>
                  </li>`
              )}
            </menu>
          </section>`;
        }
      )}
    </div>`;
  }
}
