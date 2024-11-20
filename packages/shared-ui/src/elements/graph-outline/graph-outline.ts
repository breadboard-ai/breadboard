/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  GraphIdentifier,
  InspectableGraph,
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
  NodeConfigurationUpdateRequestEvent,
  ShowTooltipEvent,
  SubGraphChosenEvent,
  ZoomToGraphEvent,
  ZoomToNodeEvent,
} from "../../events/events";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { getSubgraphColor } from "../../utils/subgraph-color";

interface Outline {
  title: string;
  nodes: InspectableNode[];
  ports: Map<NodeIdentifier, InspectableNodePorts>;
  subGraphs: Map<GraphIdentifier, Outline>;
}

const MODE_KEY = "bb-graph-outline-mode";

@customElement("bb-graph-outline")
export class GraphOutline extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  subGraphId: string | null = null;

  @property()
  renderId = "";

  @property()
  showSubgraphsInline = false;

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

    details.graph {
      margin-bottom: var(--bb-grid-size-5);
    }

    details.graph summary {
      height: var(--bb-grid-size-5);
      display: flex;
      align-items: center;
      padding-right: var(--bb-grid-size-5);
    }

    details.graph summary .title {
      color: var(--subgraph-label-color, var(--bb-neutral-800));
      flex: 1 0 auto;
    }

    details.graph summary::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 20px 20px
        no-repeat;
      display: inline-block;
      margin-right: var(--bb-grid-size);
    }

    details > summary {
      background: var(--bb-icon-unfold-more) calc(100% + 4px) center / 20px 20px
        no-repeat;
    }

    details[open] > summary {
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

    li.port > .title:has(> .port-item)::before {
      margin-right: var(--bb-grid-size);
    }

    li.node > .title > .node-item,
    li.port > .title > .port-item {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: none;
      background: var(--bb-neutral-0);
      height: var(--bb-grid-size-5);
      border-radius: var(--bb-grid-size);
      transition: background-color 0.1s cubic-bezer(0, 0, 0.3, 1);
      cursor: pointer;
      padding: 0 var(--bb-grid-size);
    }

    li.port > .title > .port-item:hover,
    li.port > .title > .port-item:focus {
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

    .change-subgraph {
      display: block;
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: var(--subgraph-label-color, var(--bb-ui-50))
        var(--bb-icon-quick-jump) center center / 16px 16px no-repeat;
      border: none;
      font-size: 0;
      border-radius: 50%;
      cursor: pointer;
    }

    .change-subgraph.inverted {
      background-image: var(--bb-icon-quick-jump-inverted);
    }

    .change-subgraph[disabled] {
      opacity: 0.4;
      cursor: default;
    }

    .title {
      display: inline-block;
      height: var(--bb-grid-size-5);
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
  `;

  #containerRef: Ref<HTMLDivElement> = createRef();
  #graphRender: Task<(InspectableGraph | string | null)[], Outline> | null =
    null;

  connectedCallback(): void {
    super.connectedCallback();

    const mode = globalThis.localStorage.getItem(MODE_KEY);
    if (mode === "list" || mode === "tree") {
      this.mode = mode;
    }
  }

  #createSubGraphId(id: string) {
    return `sg-${id}`;
  }

  #loadGraphDetails() {
    return new Task(this, {
      task: async ([graph]): Promise<Outline> => {
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

          const subGraphs = new Map<GraphIdentifier, Outline>();
          const subGraphEntries = graph.graphs();
          if (subGraphEntries) {
            for (const [id, subGraph] of Object.entries(subGraphEntries)) {
              subGraphs.set(id, await graphToOutline(subGraph, false));
            }
          }

          return {
            title: overrideTitle
              ? "Main Board"
              : (graph.raw().title ?? "Unnamed graph"),
            nodes,
            ports,
            subGraphs,
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
      this.#graphRender = this.#loadGraphDetails();
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

  #renderBoard(
    subGraphId: string | null,
    nodes: InspectableNode[],
    ports: Map<NodeIdentifier, InspectableNodePorts>,
    subGraphs: Map<GraphIdentifier, Outline>,
    renderBoardsInline = false
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
              @dblclick=${(evt: PointerEvent) => {
                this.dispatchEvent(
                  new NodeConfigurationUpdateRequestEvent(
                    node.descriptor.id,
                    subGraphId,
                    null,
                    null,
                    evt.clientX,
                    evt.clientY,
                    true
                  )
                );
              }}
              @click=${(evt: PointerEvent) => {
                const isMac = navigator.platform.indexOf("Mac") === 0;
                const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

                if (!isCtrlCommand) {
                  return;
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
                <span class="title"
                  ><button
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
                  </button></span
                >
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
                      getSubgraphColor<number>(subGraphId, "text", true) ===
                      0xffffff,
                  })}
                  ?disabled=${!this.showSubgraphsInline &&
                  this.subGraphId === subGraphId}
                  style=${styleMap({
                    "--subgraph-border-color": getSubgraphColor(
                      subGraphId,
                      "border"
                    ),
                    "--subgraph-label-color": getSubgraphColor(
                      subGraphId,
                      "label"
                    ),
                    "--subgraph-label-text-color": getSubgraphColor(
                      subGraphId,
                      "text"
                    ),
                  })}
                  @pointerover=${(evt: PointerEvent) => {
                    this.dispatchEvent(
                      new ShowTooltipEvent(
                        `Zoom to board`,
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
                      this.#scrollTo(this.#createSubGraphId(subGraphId));
                    } else {
                      if (this.showSubgraphsInline) {
                        this.dispatchEvent(new ZoomToGraphEvent(subGraphId));
                      } else {
                        this.dispatchEvent(new SubGraphChosenEvent(subGraphId));
                      }
                    }
                  }}
                >
                  ${subGraph?.title}
                </button>`;

                if (!renderBoardsInline) {
                  graphDetail = graphButton;
                } else {
                  graphDetail = html`<div>
                    ${graphButton}${this.#renderBoard(
                      subGraphId,
                      subGraph.nodes,
                      subGraph.ports,
                      subGraph.subGraphs,
                      renderBoardsInline
                    )}
                  </div>`;
                }
              }

              return html`<li
                class=${classMap({
                  port: true,
                  subgraph: !renderBoardsInline,
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

  #renderAsList(
    title: string,
    nodes: InspectableNode[],
    ports: Map<NodeIdentifier, InspectableNodePorts>,
    subGraphs: Map<GraphIdentifier, Outline>
  ) {
    return html`${html`<details id=${MAIN_BOARD_ID} class="graph" open>
      <summary>
        <span class="title">${title}</span>
        <div id="graph-controls">
          <button
            class=${classMap({ "change-subgraph": true })}
            ?disabled=${!this.showSubgraphsInline && this.subGraphId === null}
            @pointerover=${(evt: PointerEvent) => {
              this.dispatchEvent(
                new ShowTooltipEvent(
                  `Zoom to Main Board`,
                  evt.clientX,
                  evt.clientY
                )
              );
            }}
            @pointerout=${() => {
              this.dispatchEvent(new HideTooltipEvent());
            }}
            @click=${() => {
              if (this.showSubgraphsInline) {
                this.dispatchEvent(new ZoomToGraphEvent(MAIN_BOARD_ID));
              } else {
                this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
              }
            }}
          >
            Change subgraph
          </button>
        </div>
      </summary>
      ${this.#renderBoard(null, nodes, ports, subGraphs, false)}
    </details> `}${map(subGraphs, ([id, subGraph]) => {
      return html`<details
        style=${styleMap({
          "--subgraph-border-color": getSubgraphColor(id, "border"),
          "--subgraph-label-color": getSubgraphColor(id, "label"),
        })}
        id=${this.#createSubGraphId(id)}
        class="graph"
        open
      >
        <summary>
          <span class="title">${subGraph.title}</span>
          <div id="graph-controls">
            <button
              class=${classMap({
                "change-subgraph": true,
                inverted:
                  getSubgraphColor<number>(id, "text", true) === 0xffffff,
              })}
              ?disabled=${!this.showSubgraphsInline && this.subGraphId === id}
              @pointerover=${(evt: PointerEvent) => {
                this.dispatchEvent(
                  new ShowTooltipEvent(
                    `Zoom to Board`,
                    evt.clientX,
                    evt.clientY
                  )
                );
              }}
              @pointerout=${() => {
                this.dispatchEvent(new HideTooltipEvent());
              }}
              @click=${() => {
                if (this.showSubgraphsInline) {
                  this.dispatchEvent(new ZoomToGraphEvent(id));
                } else {
                  this.dispatchEvent(new SubGraphChosenEvent(id));
                }
              }}
            >
              Change subgraph
            </button>
          </div>
        </summary>
        ${this.#renderBoard(
          id,
          subGraph.nodes,
          subGraph.ports,
          subGraph.subGraphs,
          false
        )}
      </details>`;
    })}`;
  }

  #renderAsTree(
    title: string,
    nodes: InspectableNode[],
    ports: Map<NodeIdentifier, InspectableNodePorts>,
    subGraphs: Map<GraphIdentifier, Outline>
  ) {
    return html`<details id=${MAIN_BOARD_ID} class="graph" open>
      <summary>
        <span class="title">${title}</span>
        <div id="graph-controls">
          <button
            class=${classMap({ "change-subgraph": true })}
            ?disabled=${!this.showSubgraphsInline && this.subGraphId === null}
            @pointerover=${(evt: PointerEvent) => {
              this.dispatchEvent(
                new ShowTooltipEvent(
                  `Zoom to Main Board`,
                  evt.clientX,
                  evt.clientY
                )
              );
            }}
            @pointerout=${() => {
              this.dispatchEvent(new HideTooltipEvent());
            }}
            @click=${() => {
              if (this.showSubgraphsInline) {
                this.dispatchEvent(new ZoomToGraphEvent(MAIN_BOARD_ID));
              } else {
                this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
              }
            }}
          >
            Change subgraph
          </button>
        </div>
      </summary>
      ${this.#renderBoard(null, nodes, ports, subGraphs, true)}
    </details> `;
  }

  render() {
    if (!this.#graphRender) {
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
              this.mode = this.mode === "list" ? "tree" : "list";
              globalThis.localStorage.setItem(MODE_KEY, this.mode);
            }}
          >
            Toggle
          </button>
        </div>
        <div id="outline">
          ${this.#graphRender.render({
            pending: () => html`Loading...`,
            complete: (outline) => {
              let nodes = [...outline.nodes];
              if (this.filter) {
                nodes = nodes.filter((node) => {
                  const filter = new RegExp(this.filter!, "gim");
                  return filter.test(node.title());
                });
              }

              switch (this.mode) {
                case "list": {
                  return this.#renderAsList(
                    outline.title,
                    nodes,
                    outline.ports,
                    outline.subGraphs
                  );
                }
                case "tree": {
                  return this.#renderAsTree(
                    outline.title,
                    nodes,
                    outline.ports,
                    outline.subGraphs
                  );
                }
                default:
                  return html`Unexpected render type`;
              }
            },
            error: () => html`Unable to load graph outline`,
          })}
        </div>
      </div>
    `;
  }
}
