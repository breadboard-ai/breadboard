/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  createLoader,
  GraphDescriptor,
  inspect,
  InspectableGraph,
  InspectableModules,
  InspectableNodePorts,
  InspectableRun,
  Kit,
  NodeHandlerMetadata,
} from "@google-labs/breadboard";
import {
  LitElement,
  html,
  css,
  nothing,
  HTMLTemplateResult,
  PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { CodeEditor, GraphRenderer, ModuleRibbonMenu } from "../elements";
import { ModuleIdentifier, Modules } from "@breadboard-ai/types";
import { GraphAssets } from "../editor/graph-assets";
import { until } from "lit/directives/until.js";
import { GraphInitialDrawEvent, ModuleEditEvent } from "../../events/events";
import { guard } from "lit/directives/guard.js";
import { TopGraphRunResult } from "../../types/types";
import { classMap } from "lit/directives/class-map.js";

const PREVIEW_KEY = "bb-module-editor-preview-visible";

@customElement("bb-module-editor")
export class ModuleEditor extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  subGraphId: string | null = null;

  @property()
  moduleId: ModuleIdentifier | null = null;

  @property()
  modules: InspectableModules = {};

  @property()
  kits: Kit[] = [];

  @property({ reflect: true })
  focused = false;

  @state()
  pending = false;

  @property()
  readOnly = false;

  @property()
  assetPrefix = "";

  @property()
  renderId = "";

  @property()
  run: InspectableRun | null = null;

  @property()
  topGraphResult: TopGraphRunResult | null = null;

  @property()
  isShowingBoardActivityOverlay = false;

  @property()
  showModulePreview = false;

  @state()
  private formatting = false;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    section {
      display: grid;
      grid-template-rows: 44px minmax(0, 1fr) var(--bb-grid-size-12);
      row-gap: var(--bb-grid-size-4);
      width: 100%;
      height: 100%;
      position: relative;
    }

    #module-graph {
      border-radius: var(--bb-grid-size);
      height: 40vh;
      width: 40vw;
      max-height: 340px;
      max-width: 340px;
      overflow: hidden;
      position: absolute;
      right: 32px;
      top: 76px;
      box-shadow:
        0 8px 8px 0 rgba(0, 0, 0, 0.07),
        0 15px 12px 0 rgba(0, 0, 0, 0.09);
      z-index: 4;
      opacity: 0;
      pointer-events: none;
    }

    #module-graph.visible {
      opacity: 1;
    }

    bb-graph-renderer {
      width: 100%;
      height: 100%;
    }

    #code-container {
      padding: 0 var(--bb-grid-size-4);
    }

    #code-container-outer {
      width: 100%;
      height: 100%;
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
      overflow-y: auto;
    }

    :host([focused="true"]) #code-container-outer {
      border: 1px solid var(--bb-ui-700);
      box-shadow: inset 0 0 0 1px var(--bb-ui-700);
    }

    #code-container-inner {
      width: 100%;
      height: 100%;
      overflow-y: scroll;
      background: white;
    }

    #revert {
      background: transparent;
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-right: var(--bb-grid-size-2);
    }

    #update {
      background: var(--bb-ui-500);
      border: none;
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-4) var(--bb-grid-size)
        var(--bb-grid-size-2);
      border-radius: var(--bb-grid-size-12);
      display: flex;
      justify-content: flex-end;
      align-items: center;
      cursor: pointer;
      transition: background-color 0.3s cubic-bezier(0, 0, 0.3, 1);
    }

    #update::before {
      content: "";
      display: block;
      width: 20px;
      height: 20px;
      background: transparent var(--bb-icon-check-inverted) center center / 20px
        20px no-repeat;
      margin-right: var(--bb-grid-size-2);
    }

    #update:not([disabled]):hover,
    #update:not([disabled]):focus {
      background: var(--bb-ui-600);
      transition-duration: 0.1s;
    }

    #update[disabled] {
      opacity: 0.5;
      cursor: default;
    }

    #buttons > div {
      display: flex;
      justify-content: flex-end;
      width: 100%;
      padding-right: var(--bb-grid-size-4);
      flex: 0 0 auto;
    }
  `;

  #moduleRibbonMenuRef: Ref<ModuleRibbonMenu> = createRef();
  #codeEditorRef: Ref<CodeEditor> = createRef();
  #graphVersion = 1;
  #graphRenderer = new GraphRenderer();

  connectedCallback(): void {
    super.connectedCallback();

    this.showModulePreview =
      globalThis.localStorage.getItem(PREVIEW_KEY) === "true";
  }

  async #formatCode() {
    if (!this.#codeEditorRef.value) {
      return;
    }

    const editor = this.#codeEditorRef.value;
    if (!editor.value) {
      return;
    }

    const [Prettier, PrettierESTree, PrettierTS] = await Promise.all([
      import("prettier"),
      // @ts-expect-error Does not provide types.
      import("prettier/plugins/estree.mjs"),
      // @ts-expect-error Does not provide types.
      import("prettier/plugins/typescript.mjs"),
    ]);

    const formatted = await Prettier.format(editor.value, {
      arrowParens: "always",
      printWidth: 80,
      semi: true,
      tabWidth: 2,
      trailingComma: "es5",
      useTabs: false,
      parser: "typescript",
      plugins: [PrettierESTree, PrettierTS],
    });

    editor.value = formatted;
  }

  processData() {
    if (
      !this.#codeEditorRef.value ||
      !this.#moduleRibbonMenuRef.value ||
      !this.moduleId
    ) {
      return;
    }

    const editor = this.#codeEditorRef.value;
    const ribbonMenu = this.#moduleRibbonMenuRef.value;
    const module = this.modules[this.moduleId];
    if (!module) {
      return;
    }

    const metadata = module.metadata();
    metadata.runnable = ribbonMenu.moduleIsRunnable();

    this.dispatchEvent(
      new ModuleEditEvent(this.moduleId, editor.value ?? "", metadata)
    );
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("renderId")) {
      this.pending = false;
    }
  }

  destroyEditor() {
    if (!this.#codeEditorRef.value) {
      return;
    }

    this.#codeEditorRef.value.destroy();
  }

  #createModuleGraph(): GraphDescriptor | null {
    if (!this.moduleId || !this.modules) {
      return null;
    }

    const modules: Modules = {};
    for (const [id, module] of Object.entries(this.modules)) {
      modules[id] = {
        code: module.code(),
        metadata: module.metadata(),
      };
    }

    return {
      nodes: [
        {
          id: this.moduleId,
          type: "runModule",
          metadata: {
            title: `Demo Component`,
            visual: {
              collapsed: "expanded",
            },
          },
          configuration: {
            $module: this.moduleId,
          },
        },
      ],
      edges: [],
      modules,
    };
  }

  async #processGraph(graph: InspectableGraph | null): Promise<GraphRenderer> {
    if (GraphAssets.assetPrefix !== this.assetPrefix) {
      GraphAssets.instance().loadAssets(this.assetPrefix);
      await GraphAssets.instance().loaded;
    }

    await this.#graphRenderer.ready;

    if (!graph) {
      this.#graphRenderer.deleteGraphs();
      return this.#graphRenderer;
    }

    this.#graphVersion++;
    this.#graphRenderer.readOnly = true;
    this.#graphRenderer.padding = 28;

    const selectedGraph = graph;

    // Force a reset when the board changes.
    const url = graph.raw().url ?? "module-graph";

    const ports = new Map<string, InspectableNodePorts>();
    const typeMetadata = new Map<string, NodeHandlerMetadata>();
    const graphVersion = this.#graphVersion;

    for (const node of selectedGraph.nodes()) {
      ports.set(node.descriptor.id, await node.ports());
      try {
        typeMetadata.set(node.descriptor.type, await node.type().metadata());
      } catch (err) {
        console.warn(err);
      }

      if (this.#graphVersion !== graphVersion) {
        // Another update has come in, bail out.
        return this.#graphRenderer;
      }
    }

    if (!selectedGraph) {
      return this.#graphRenderer;
    }

    this.#graphRenderer.hideAllGraphs();
    this.#graphRenderer.removeGraphs([]);

    // Attempt to update the graph if it already exists.
    const updated = this.#graphRenderer.updateGraphByUrl(url, null, {
      showNodeTypeDescriptions: true,
      showNodePreviewValues: true,
      collapseNodesByDefault: false,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      metadata: selectedGraph.metadata(),
    });

    if (updated) {
      this.#graphRenderer.showGraph(url, null);
      return this.#graphRenderer;
    }

    this.#graphRenderer.createGraph({
      url,
      subGraphId: null,
      showNodeTypeDescriptions: true,
      showNodePreviewValues: true,
      collapseNodesByDefault: false,
      ports: ports,
      typeMetadata,
      edges: selectedGraph.edges(),
      nodes: selectedGraph.nodes(),
      metadata: selectedGraph.metadata() || {},
      visible: false,
    });

    this.#graphRenderer.addEventListener(
      GraphInitialDrawEvent.eventName,
      () => {
        this.#graphRenderer.showGraph(url, null);
        this.#graphRenderer.zoomToFit(true, 0);
      },
      { once: true }
    );

    return this.#graphRenderer;
  }

  #togglePreview(value = !this.showModulePreview) {
    this.showModulePreview = value;
    globalThis.localStorage.setItem(PREVIEW_KEY, `${this.showModulePreview}`);
  }

  render() {
    if (!this.modules || !this.moduleId) {
      return nothing;
    }

    const moduleGraphDescriptor = this.#createModuleGraph();
    let moduleGraph: HTMLTemplateResult | symbol = nothing;
    if (moduleGraphDescriptor) {
      const inspectedModuleGraph = inspect(moduleGraphDescriptor, {
        kits: this.kits,
        loader: createLoader([], { disableDefaultProvider: true }),
      });

      moduleGraph = html`${guard([this.moduleId, this.renderId], () => {
        return html`${until(this.#processGraph(inspectedModuleGraph))}`;
      })}`;
    }

    const module = this.modules[this.moduleId];
    if (!module) {
      return nothing;
    }

    const isRunning = this.topGraphResult
      ? this.topGraphResult.status === "running" ||
        this.topGraphResult.status === "paused"
      : false;

    let isInputPending = false;
    let isError = false;
    const eventCount = this.run?.events.length ?? 0;
    const newestEvent = this.run?.events.at(-1);
    if (newestEvent) {
      isInputPending =
        newestEvent.type === "node" &&
        newestEvent.node.descriptor.type === "input";
      isError = newestEvent.type === "error";
    }

    const isRunnable = !!module.metadata().runnable;
    return html` <div
        id="module-graph"
        class=${classMap({ visible: this.showModulePreview && isRunnable })}
      >
        ${moduleGraph}
      </div>
      <section>
        <bb-module-ribbon-menu
          ${ref(this.#moduleRibbonMenuRef)}
          .graph=${this.graph}
          .modules=${this.modules}
          .moduleId=${this.moduleId}
          .canSave=${false}
          .readOnly=${this.readOnly}
          .isRunning=${isRunning}
          .eventCount=${eventCount}
          .isInputPending=${isInputPending}
          .isError=${isError}
          .isShowingBoardActivityOverlay=${this.isShowingBoardActivityOverlay}
          .isShowingModulePreview=${this.showModulePreview}
          .canShowModulePreview=${isRunnable}
          .formatting=${this.formatting}
          @input=${() => {
            this.pending = true;
          }}
          @bbtogglepreview=${() => this.#togglePreview()}
          @bbformatmodulecode=${async () => {
            if (this.formatting) {
              return;
            }

            this.formatting = true;
            await this.#formatCode();
            this.formatting = false;
          }}
        ></bb-module-ribbon-menu>
        <div id="code-container">
          <div id="code-container-outer">
            <div id="code-container-inner">
              <bb-code-editor
                ${ref(this.#codeEditorRef)}
                @bbcodechange=${() => {
                  this.pending = true;
                }}
                @focus=${() => {
                  requestAnimationFrame(() => {
                    this.focused = true;
                  });
                }}
                @blur=${() => {
                  requestAnimationFrame(() => {
                    this.focused = false;
                  });
                }}
                .passthru=${true}
                .value=${module.code()}
              ></bb-code-editor>
            </div>
          </div>
        </div>
        <div id="buttons">
          <div>
            <button
              id="revert"
              @click=${() => {
                if (!this.#codeEditorRef.value || !module) {
                  return;
                }

                this.#codeEditorRef.value.value = module.code() ?? null;
                this.pending = false;
              }}
            >
              Revert to saved
            </button>
            <button
              ?disabled=${!this.pending}
              id="update"
              @click=${() => {
                this.processData();
              }}
            >
              Apply changes
            </button>
          </div>
        </div>
      </section>`;
  }
}