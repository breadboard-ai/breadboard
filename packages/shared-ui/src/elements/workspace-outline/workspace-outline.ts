/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  GraphIdentifier,
  InspectableGraph,
  InspectableModule,
  InspectableNode,
  InspectableNodePorts,
  Kit,
  NodeIdentifier,
  NodeValue,
} from "@google-labs/breadboard";
import { Task } from "@lit/task";
import {
  LitElement,
  html,
  css,
  PropertyValues,
  nothing,
  HTMLTemplateResult,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import {
  HideTooltipEvent,
  ModuleChosenEvent,
  ModuleCreateEvent,
  NodeConfigurationUpdateRequestEvent,
  OutlineModeChangeEvent,
  ShowTooltipEvent,
  SubGraphChosenEvent,
  SubGraphCreateEvent,
  ZoomToGraphEvent,
  ZoomToNodeEvent,
} from "../../events/events";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { getSubItemColor } from "../../utils/subgraph-color";
import { isConfigurableBehavior } from "../../utils";
import { ModuleIdentifier } from "@breadboard-ai/types";
import { getModuleId } from "../../utils/module-id";

type ItemIdentifier = GraphIdentifier | ModuleIdentifier;

interface Outline {
  title: string;
  items: {
    nodes: InspectableNode[];
    ports: Map<NodeIdentifier, InspectableNodePorts>;
  };
  type: "imperative" | "declarative";
  subItems: Map<ItemIdentifier, Outline>;
}

@customElement("bb-workspace-outline")
export class WorkspaceOutline extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  subGraphId: GraphIdentifier | null = null;

  @property()
  moduleId: ModuleIdentifier | null = null;

  @property()
  renderId = "";

  @property({ reflect: true })
  mode: "list" | "tree" = "list";

  @state()
  filter: string | null = null;

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--bb-neutral-0);
      min-width: 220px;
      height: 100%;
      overflow: hidden;
    }

    h1 {
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size) 0;
    }

    #controls {
      height: var(--bb-grid-size-16);
      padding: var(--bb-grid-size-4);
      display: grid;
      grid-template-columns: 1fr min-content;
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

    #controls #view-toggle {
      width: 60px;
      font-size: 0;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
      padding: 0;
      background: var(--bb-neutral-0);
      position: relative;
      cursor: pointer;
    }

    #controls #view-toggle::after {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      background: transparent;
      background-image: var(--bb-icon-list), var(--bb-icon-tree);
      background-position:
        4px center,
        34px center;
      background-size:
        20px 20px,
        20px 20px;
      background-repeat: no-repeat, no-repeat;
      position: relative;
    }

    #controls #view-toggle::before {
      content: "";
      display: block;
      width: calc(50% - 1px);
      height: 100%;
      background: var(--bb-ui-50);
      position: absolute;
      border-radius: var(--bb-grid-size) 0 0 var(--bb-grid-size);
      border-right: 1px solid var(--bb-neutral-300);
    }

    #controls #view-toggle.tree::before {
      left: 50%;
      border-radius: 0 var(--bb-grid-size) var(--bb-grid-size) 0;
      border-left: 1px solid var(--bb-neutral-300);
      border-right: none;
    }

    #container {
      overflow: auto;
      height: 100%;
    }

    #outline {
      height: calc(100% - var(--bb-grid-size-16));
      overflow: scroll;
      padding: 0 var(--bb-grid-size-4);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary {
      list-style: none;
    }

    details.declarative,
    details.imperative {
      margin-bottom: var(--bb-grid-size-2);
    }

    details.declarative:last-of-type,
    details.imperative:last-of-type {
      margin-bottom: var(--bb-grid-size-5);
    }

    details.declarative summary,
    details.imperative summary {
      height: var(--bb-grid-size-7);
      display: flex;
      align-items: center;
      padding-right: var(--bb-grid-size-5);
    }

    details.declarative summary .title,
    details.imperative summary .title {
      color: var(--subgraph-label-color, var(--bb-neutral-800));
      flex: 1 0 auto;
    }

    details.declarative summary::before,
    details.imperative summary::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 20px 20px
        no-repeat;
      display: inline-block;
      margin-right: var(--bb-grid-size);
    }

    details.imperative summary::before {
      background-image: var(--bb-icon-extension);
    }

    details.declarative > summary {
      cursor: pointer;
      background: var(--bb-icon-unfold-more) calc(100% + 4px) center / 20px 20px
        no-repeat;
    }

    details.declarative[open] > summary {
      background: var(--bb-icon-unfold-less) calc(100% + 4px) center / 20px 20px
        no-repeat;
    }

    ul {
      margin: 0 0 0 var(--bb-grid-size-2);
      padding: 0;
      border-left: 1px solid var(--bb-neutral-300);
      list-style: none;
    }

    details[id^="sg-"] > ul {
      border-left: 1px solid var(--subgraph-border-color, var(--bb-neutral-300));
    }

    ul.ports {
      border-left: 1px solid transparent;
      position: relative;
    }

    ul.ports::before {
      content: "";
      position: absolute;
      left: 0;
      width: 1px;
      height: calc(100% - var(--bb-grid-size-3));
      background: var(--bb-neutral-300);
      padding: 0;
    }

    li {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      white-space: nowrap;
      margin: var(--bb-grid-size) 0;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      padding: 0 0 0 var(--bb-grid-size-2);
      position: relative;
    }

    li:has(> div > ul):last-of-type::after {
      content: "";
      background: var(--bb-neutral-0);
      width: 3px;
      top: 9px;
      height: calc(100% - 10px);
      position: absolute;
      left: -1px;
    }

    li.subgraph {
      display: flex;
      align-items: center;
    }

    li.port {
      position: relative;
      padding: 0 0 0 var(--bb-grid-size-6);
    }

    li.port::before {
      content: "";
      height: 1px;
      top: 8px;
      width: var(--bb-grid-size-4);
      background: var(--bb-neutral-300);
      position: absolute;
      left: 0;
    }

    li.port > .title::before {
      content: "";
      width: 8px;
      height: 8px;
      border: 1px solid var(--bb-neutral-500);
      background: var(--bb-neutral-0);
      border-radius: 50%;
      margin-right: var(--bb-grid-size);
      display: inline-block;
    }

    li.port > .title::before {
      margin-right: var(--bb-grid-size-2);
    }

    li.port > .title:has(.port-item)::before {
      margin-right: 0;
    }

    li.node > .title > .node-item,
    li.port > .title > .port-item {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: none;
      background: var(--bb-neutral-0);
      height: var(--bb-grid-size-5);
      border-radius: var(--bb-grid-size);
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
      padding: 0 var(--bb-grid-size);
      display: inline-block;
      line-height: var(--bb-grid-size-5);
      cursor: pointer;
    }

    li.port > .title > button.port-item:hover,
    li.port > .title > button.port-item:focus {
      background: var(--bb-ui-50);
    }

    li.port.connected > .title::before {
      background: var(--bb-input-200);
      border: 1px solid var(--bb-input-600);
    }

    li.port.connected.configured > .title::before {
      background: var(--bb-ui-300);
      border: 1px solid var(--bb-ui-600);
    }

    li.port.missing > .title::before {
      background: var(--bb-warning-300);
      border: 1px solid var(--bb-warning-700);
    }

    li.node > .title {
      display: flex;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    li.node > .title::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 20px 20px
        no-repeat;
      display: inline-block;
      margin-right: var(--bb-grid-size);
      flex: 0 0 auto;
    }

    li.node.input > .title::before {
      background: transparent var(--bb-icon-input) center center / 20px 20px
        no-repeat;
    }

    li.node.specialist > .title::before,
    li.node.model > .title::before {
      background: transparent var(--bb-icon-smart-toy) center center / 20px 20px
        no-repeat;
    }

    li.node.output > .title::before {
      background: transparent var(--bb-icon-output) center center / 20px 20px
        no-repeat;
    }

    li.node.runModule > .title::before {
      background: transparent var(--bb-icon-extension) center center / 20px 20px
        no-repeat;
    }

    li.node.runJavascript > .title::before {
      background: transparent var(--bb-icon-javascript) center center / 20px
        20px no-repeat;
    }

    li.node.content > .title::before {
      background: transparent var(--bb-icon-code-blocks) center center / 20px
        20px no-repeat;
    }

    li.node.secrets > .title::before {
      background: transparent var(--bb-icon-secrets) center center / 20px 20px
        no-repeat;
    }

    li.node.human > .title::before {
      background: transparent var(--bb-icon-human) center -1px / 20px 20px no-repeat;
    }

    li.node.urlTemplate > .title::before {
      background: transparent var(--bb-icon-http) center -1px / 20px 20px no-repeat;
    }

    li.node.fetch > .title::before {
      background: transparent var(--bb-icon-fetch) center -1px / 20px 20px no-repeat;
    }

    li.node.jsonata > .title::before {
      background: transparent var(--bb-icon-jsonata) center -1px / 20px 20px no-repeat;
    }

    li.node.joiner > .title::before {
      background: transparent var(--bb-icon-merge-type) center -1px / 20px 20px no-repeat;
    }

    .change-subitem {
      color: var(--bb-neutral-800);
      display: block;
      background: var(--bb-neutral-0);
      border: none;
      border-radius: var(--bb-grid-size);
      cursor: pointer;
      padding: 0 var(--bb-grid-size-2);
      height: var(--bb-grid-size-7);
      flex: 1;
      text-align: left;
      transition: background 0.1s cubic-bezier(0, 0, 0.3, 1);
    }

    .change-subitem:hover,
    .change-subitem:focus {
      background: var(--subgraph-label-color, var(--bb-ui-50));
    }

    .change-subitem.inverted:hover,
    .change-subitem.inverted:focus {
      color: var(--bb-neutral-0);
    }

    .change-subitem[disabled] {
      background: var(--subgraph-label-color, var(--bb-ui-50));
      cursor: default;
    }

    .change-subitem[disabled].inverted {
      color: var(--bb-neutral-0);
    }

    .title {
      display: inline-flex;
      align-items: center;
      height: var(--bb-grid-size-5);
      flex: 1;
    }

    .title:has(> .change-subitem) {
      height: var(--bb-grid-size-7);
    }

    .preview {
      font: 400 italic var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-left: var(--bb-grid-size-2);
    }

    button.subgraph {
      display: inline-flex;
      align-items: center;
      border: none;
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      background: var(--subgraph-label-color, var(--bb-ui-50));
      border-radius: 40px;
      height: var(--bb-grid-size-5);
      padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size);
      color: var(--subgraph-label-text-color, var(--bb-neutral-800));
      cursor: pointer;
    }

    :host([mode="tree"]) button.subgraph {
      margin-left: calc(var(--bb-grid-size-2) * -1);
    }

    :host([mode="list"]) button.subgraph {
      margin-left: var(--bb-grid-size-2);
    }

    button.subgraph[disabled] {
      opacity: 0.4;
      cursor: default;
    }

    button.subgraph::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 16px 16px
        no-repeat;
      margin-right: var(--bb-grid-size);
    }

    button.subgraph.inverted::before {
      background-image: var(--bb-icon-board-inverted);
    }

    #create-new {
      margin-bottom: var(--bb-grid-size-3);
    }

    .create-new-board {
      border-radius: var(--bb-grid-size-6);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      background: var(--bb-neutral-0) var(--bb-icon-add-circle) 6px center /
        16px 16px no-repeat;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-900);
      cursor: pointer;
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
      border: 1px solid var(--bb-neutral-300);
    }

    .create-new-board:hover,
    .create-new-board:focus {
      background-color: var(--bb-neutral-50);
    }

    .create-new-module {
      border-radius: var(--bb-grid-size-6);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      background: var(--bb-neutral-0) var(--bb-icon-add-circle) 6px center /
        16px 16px no-repeat;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-900);
      cursor: pointer;
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
      border: 1px solid var(--bb-neutral-300);
    }

    .create-new-module:hover,
    .create-new-module:focus {
      background-color: var(--bb-neutral-50);
    }
  `;

  #containerRef: Ref<HTMLDivElement> = createRef();
  #workspaceRender: Task<(InspectableGraph | string | null)[], Outline> | null =
    null;

  #createSubItemId(id: string) {
    return `sg-${id}`;
  }

  #loadGraphDetails() {
    return new Task(this, {
      task: async ([graph]): Promise<Outline> => {
        const moduleToOutline = async (
          id: ModuleIdentifier,
          module: InspectableModule
        ): Promise<Outline> => {
          return {
            type: "imperative",
            title: module.metadata().title ?? id,
            items: {
              nodes: [],
              ports: new Map(),
            },
            subItems: new Map(),
          };
        };

        const graphToOutline = async (
          graph: InspectableGraph,
          overrideTitle = true
        ): Promise<Outline> => {
          const nodes: InspectableNode[] = [];
          const ports: Map<NodeIdentifier, InspectableNodePorts> = new Map();
          for (const node of graph.nodes()) {
            nodes.push(node);

            const nodePorts = await node.ports();
            ports.set(node.descriptor.id, nodePorts);
          }

          nodes.sort((a, b) => {
            // Attempt to sort inputs to the front, and outputs to the back.
            if (
              a.descriptor.type === "input" &&
              b.descriptor.type !== "input"
            ) {
              return -1;
            }

            if (
              b.descriptor.type === "input" &&
              a.descriptor.type !== "input"
            ) {
              return 1;
            }

            if (
              a.descriptor.type === "output" &&
              b.descriptor.type !== "output"
            ) {
              return 1;
            }

            if (
              b.descriptor.type === "output" &&
              a.descriptor.type !== "output"
            ) {
              return -1;
            }

            // Fall through to titles.
            if (a.title() < b.title()) {
              return -1;
            }

            if (a.title() > b.title()) {
              return 1;
            }

            return 0;
          });

          const subItems = new Map<
            GraphIdentifier | ModuleIdentifier,
            Outline
          >();
          const subGraphs = graph.graphs();
          if (subGraphs) {
            for (const [id, subGraph] of Object.entries(subGraphs)) {
              subItems.set(id, await graphToOutline(subGraph, false));
            }
          }

          const modules = graph.modules();
          if (modules) {
            for (const [id, module] of Object.entries(modules)) {
              subItems.set(id, await moduleToOutline(id, module));
            }
          }

          return {
            type: "declarative",
            title: overrideTitle
              ? "Main Board"
              : (graph.raw().title ?? "Unnamed graph"),
            items: {
              nodes,
              ports,
            },
            subItems,
          } as Outline;
        };

        if (typeof graph !== "object" || Array.isArray(graph)) {
          throw new Error("Unsupported information");
        }

        if (!graph) {
          throw new Error("Unable to load graph");
        }

        return graphToOutline(graph);
      },
      onError: () => {
        // TODO.
      },
      args: () => [this.graph, this.subGraphId],
    });
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("graph")) {
      this.#workspaceRender = this.#loadGraphDetails();
    }
  }

  #scrollTo(subGraphId: string) {
    if (!this.#containerRef.value) {
      return;
    }

    const subGraph = this.#containerRef.value.querySelector(`#${subGraphId}`);
    if (!subGraph) {
      return;
    }

    subGraph.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "start",
    });
  }

  #renderPreview(value: NodeValue) {
    let preview = "";
    switch (typeof value) {
      case "object": {
        preview = JSON.stringify(value);
        break;
      }

      case "undefined": {
        preview = "";
        break;
      }

      default: {
        preview = `${value}`;
        break;
      }
    }

    return preview;
  }

  #renderWorkspaceItem(
    subGraphId: string | null,
    nodes: InspectableNode[],
    ports: Map<NodeIdentifier, InspectableNodePorts>,
    subGraphs: Map<GraphIdentifier, Outline>,
    seenSubItems: Set<string>,
    renderSubItemsInline = false
  ): HTMLTemplateResult {
    return html`<ul>
      ${map(nodes, (node) => {
        const { type } = node.descriptor;
        const nodePorts: InspectableNodePorts = ports.get(
          node.descriptor.id
        ) ?? {
          inputs: { ports: [], fixed: false },
          outputs: { ports: [], fixed: false },
          side: { ports: [], fixed: false },
        };

        return html`<li class=${classMap({ node: true, [type]: true })}>
          <span class="title"
            ><button
              class="node-item"
              @click=${() => {
                if (this.subGraphId !== subGraphId && this.mode === "list") {
                  this.dispatchEvent(
                    new SubGraphChosenEvent(
                      subGraphId ? subGraphId : MAIN_BOARD_ID,
                      node.descriptor.id
                    )
                  );

                  return;
                }

                if (this.mode === "tree" && this.moduleId) {
                  this.dispatchEvent(new ModuleChosenEvent(null));
                }

                this.dispatchEvent(
                  new ZoomToNodeEvent(node.descriptor.id, subGraphId)
                );
              }}
            >
              ${node.title()}
            </button></span
          >
          <ul class="ports">
            ${map(nodePorts.inputs.ports, (port) => {
              if (port.name === "*" || port.name === "") {
                return nothing;
              }

              return html`<li
                class=${classMap({
                  port: true,
                  [port.status]: true,
                  configured: port.configured,
                })}
              >
                <span class="title">
                  ${isConfigurableBehavior(port.schema)
                    ? html`<button
                        class="port-item"
                        @click=${(evt: PointerEvent) => {
                          const addHorizontalClickClearance = true;
                          this.dispatchEvent(
                            new NodeConfigurationUpdateRequestEvent(
                              node.descriptor.id,
                              subGraphId,
                              port,
                              port.name,
                              evt.clientX,
                              evt.clientY,
                              addHorizontalClickClearance
                            )
                          );
                        }}
                      >
                        ${port.title}
                      </button>`
                    : html`<span class="port-item">${port.title}</span>`}
                </span>
                <span class="preview">${this.#renderPreview(port.value)}</span>
              </li>`;
            })}
            ${map(nodePorts.side.ports, (port) => {
              if (port.name === "*" || port.name === "") {
                return nothing;
              }

              let graphDetail: HTMLTemplateResult | symbol = nothing;
              const subGraphId = (port.value as GraphIdentifier).slice(1);
              const subGraph = subGraphs.get(subGraphId);
              if (!subGraph) {
                graphDetail = html`Unable to locate subgraph`;
              } else {
                const graphButton = html`<button
                  class=${classMap({
                    subgraph: true,
                    inverted:
                      getSubItemColor<number>(subGraphId, "text", true) ===
                      0xffffff,
                  })}
                  ?disabled=${this.mode === "list" &&
                  this.subGraphId === subGraphId}
                  style=${styleMap({
                    "--subgraph-border-color": getSubItemColor(
                      subGraphId,
                      "border"
                    ),
                    "--subgraph-label-color": getSubItemColor(
                      subGraphId,
                      "label"
                    ),
                    "--subgraph-label-text-color": getSubItemColor(
                      subGraphId,
                      "text"
                    ),
                  })}
                  @pointerover=${(evt: PointerEvent) => {
                    this.dispatchEvent(
                      new ShowTooltipEvent(
                        `Go to item`,
                        evt.clientX,
                        evt.clientY
                      )
                    );
                  }}
                  @pointerout=${() => {
                    this.dispatchEvent(new HideTooltipEvent());
                  }}
                  @click=${() => {
                    if (this.mode === "list") {
                      this.#scrollTo(this.#createSubItemId(subGraphId));
                    } else {
                      if (this.mode === "tree") {
                        this.dispatchEvent(new ZoomToGraphEvent(subGraphId));
                      } else {
                        this.dispatchEvent(new SubGraphChosenEvent(subGraphId));
                      }
                    }
                  }}
                >
                  ${subGraph?.title}
                </button>`;

                if (!renderSubItemsInline) {
                  graphDetail = graphButton;
                } else {
                  graphDetail = html`<div>
                    ${graphButton}${this.#renderWorkspaceItem(
                      subGraphId,
                      subGraph.items.nodes,
                      subGraph.items.ports,
                      subGraph.subItems,
                      seenSubItems,
                      renderSubItemsInline
                    )}
                  </div>`;
                }
              }

              return html`<li
                class=${classMap({
                  port: true,
                  subgraph: !renderSubItemsInline,
                  [port.status]: true,
                  configured: port.configured,
                })}
              >
                <span class="title">${port.title}</span>${graphDetail}
              </li>`;
            })}
          </ul>
        </li>`;
      })}
    </ul>`;
  }

  #renderWorkspace(
    title: string,
    nodes: InspectableNode[],
    ports: Map<NodeIdentifier, InspectableNodePorts>,
    subItems: Map<ItemIdentifier, Outline>,
    renderSubItemsInline: boolean
  ) {
    const seenSubItems = new Set<string>();
    return html`${html`<details
        id=${MAIN_BOARD_ID}
        class="declarative"
        ?open=${renderSubItemsInline || subItems.size === 0}
      >
        <summary>
          <div class="title">
            <button
              class=${classMap({ "change-subitem": true })}
              ?disabled=${this.mode === "list" &&
              this.subGraphId === null &&
              this.moduleId === null}
              @click=${() => {
                if (this.mode === "list") {
                  if (this.moduleId !== null) {
                    this.dispatchEvent(new ModuleChosenEvent(null));
                  }

                  if (this.subGraphId !== null) {
                    this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
                  }
                } else {
                  if (this.moduleId) {
                    this.dispatchEvent(new ModuleChosenEvent(null));
                  }

                  this.dispatchEvent(new ZoomToGraphEvent(MAIN_BOARD_ID));
                }
              }}
            >
              ${title}
            </button>
          </div>
        </summary>
        ${this.#renderWorkspaceItem(
          null,
          nodes,
          ports,
          subItems,
          seenSubItems,
          renderSubItemsInline
        )}
      </details> `}
      ${subItems.size > seenSubItems.size
        ? html`<h1>Other items</h1>`
        : nothing}
      <div id="create-new">
        <button
          class="create-new-board"
          @click=${() => {
            const newSubGraphName = prompt(
              "What would you like to call this board?"
            );
            if (!newSubGraphName) {
              return;
            }

            this.dispatchEvent(new SubGraphCreateEvent(newSubGraphName));
          }}
        >
          Create a new board...
        </button>
        <button
          class="create-new-module"
          @click=${() => {
            const moduleId = getModuleId();
            if (!moduleId) {
              return;
            }

            this.dispatchEvent(new ModuleCreateEvent(moduleId));
          }}
        >
          Create a new module...
        </button>
      </div>
      ${map(subItems, ([id, subItem]) => {
        if (seenSubItems.has(id)) {
          return nothing;
        }

        return html`<details
          style=${styleMap({
            "--subgraph-border-color": getSubItemColor(id, "border"),
            "--subgraph-label-color": getSubItemColor(id, "label"),
          })}
          id=${this.#createSubItemId(id)}
          class=${classMap({ [subItem.type]: true })}
        >
          <summary>
            <div class="title">
              <button
                class=${classMap({
                  "change-subitem": true,
                  inverted:
                    getSubItemColor<number>(id, "text", true) === 0xffffff,
                })}
                ?disabled=${this.subGraphId === id || this.moduleId === id}
                @click=${() => {
                  if (subItem.type === "declarative") {
                    if (this.mode === "tree") {
                      if (this.moduleId) {
                        this.dispatchEvent(new ModuleChosenEvent(null));
                      }

                      this.dispatchEvent(new ZoomToGraphEvent(id));
                    } else {
                      this.dispatchEvent(new SubGraphChosenEvent(id));
                      this.dispatchEvent(new ModuleChosenEvent(null));
                    }
                  } else {
                    this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
                    this.dispatchEvent(new ModuleChosenEvent(id));
                  }
                }}
              >
                ${subItem.title}
              </button>
            </div>
          </summary>
          ${this.#renderWorkspaceItem(
            id,
            subItem.items.nodes,
            subItem.items.ports,
            subItem.subItems,
            seenSubItems,
            false
          )}
        </details>`;
      })}`;
  }

  render() {
    if (!this.#workspaceRender) {
      return nothing;
    }

    return html`
      <div id="container" ${ref(this.#containerRef)}>
        <div id="controls">
          <input
            @input=${(evt: InputEvent) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              this.filter = evt.target.value;
            }}
            placeholder="Search for an item"
            type="search"
          />
          <button
            id="view-toggle"
            class=${classMap({ [this.mode]: true })}
            @click=${() => {
              this.dispatchEvent(
                new OutlineModeChangeEvent(
                  this.mode === "list" ? "tree" : "list"
                )
              );
            }}
          >
            Toggle
          </button>
        </div>
        <div id="outline">
          ${this.#workspaceRender.render({
            pending: () => html`Loading...`,
            complete: (outline) => {
              let nodes = [...outline.items.nodes];
              if (this.filter) {
                nodes = nodes.filter((node) => {
                  const filter = new RegExp(this.filter!, "gim");
                  return filter.test(node.title());
                });
              }

              return this.#renderWorkspace(
                outline.title,
                nodes,
                outline.items.ports,
                outline.subItems,
                this.mode === "tree"
              );
            },
            error: () => html`Unable to load graph outline`,
          })}
        </div>
      </div>
    `;
  }
}
