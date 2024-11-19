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
import { SubGraphChosenEvent } from "../../events/events";
import { MAIN_BOARD_ID } from "../../constants/constants";

interface Outline {
  title: string;
  nodes: InspectableNode[];
  ports: Map<NodeIdentifier, InspectableNodePorts>;
  subGraphs: Map<GraphIdentifier, Outline>;
}

@customElement("bb-graph-outline")
export class GraphOutline extends LitElement {
  @property()
  graph: InspectableGraph | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  subGraphId: string | null = null;

  @state()
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
      top: calc(50% - 2px);
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

    li.port.connected.configured > .title::before,
    li.port.connected > .title::before {
      background: var(--bb-ui-300);
      border: 1px solid var(--bb-ui-600);
    }

    .item.status.missing .title::before {
      background: var(--bb-warning-300);
      border: 1px solid var(--bb-warning-700);
    }

    li.node > .title {
      display: flex;
      align-items: center;
    }

    li.node > .title::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 20px 20px
        no-repeat;
      display: inline-block;
      margin-right: var(--bb-grid-size);
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
      background: var(--bb-ui-50) var(--bb-icon-quick-jump) center center / 16px
        16px no-repeat;
      border: none;
      font-size: 0;
      border-radius: 50%;
      cursor: pointer;
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
      margin-left: var(--bb-grid-size-2);
      border: none;
      font: 400 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        var(--bb-font-family);
      background: var(--bb-ui-50);
      border-radius: 40px;
      height: var(--bb-grid-size-5);
      padding: 0 var(--bb-grid-size-2) 0 var(--bb-grid-size);
    }

    button.subgraph::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 16px 16px
        no-repeat;
      margin-right: var(--bb-grid-size);
    }
  `;

  #graphRender: Task<(InspectableGraph | string | null)[], Outline> | null =
    null;
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

  #renderPreview(value: NodeValue) {
    let preview = "";
    switch (typeof value) {
      case "object": {
        preview = JSON.stringify(value);
        break;
      }

      default: {
        preview = preview.toString();
        break;
      }
    }

    return preview;
  }

  #renderBoard(
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
          <span class="title">${node.title()}</span>
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
                <span class="title">${port.title}</span>
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
                if (!renderBoardsInline) {
                  graphDetail = html`<button
                    class="subgraph"
                    @click=${() => {
                      this.dispatchEvent(new SubGraphChosenEvent(subGraphId));
                    }}
                  >
                    ${subGraph?.title}
                  </button>`;
                } else {
                  graphDetail = this.#renderBoard(
                    subGraph.nodes,
                    subGraph.ports,
                    subGraph.subGraphs,
                    renderBoardsInline
                  );
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
    return html`${html`<details class="graph" open>
      <summary>
        <span class="title">${title}</span>
        ${
          this.subGraphId !== null
            ? html`<div id="graph-controls">
                <button
                  class="change-subgraph"
                  @click=${() => {
                    this.dispatchEvent(new SubGraphChosenEvent(MAIN_BOARD_ID));
                  }}
                >
                  Change subgraph
                </button>
              </div>`
            : nothing
        }</div>
      </summary>
      ${this.#renderBoard(nodes, ports, subGraphs, false)}
    </details> `}${map(subGraphs, ([id, subGraph]) => {
      return html`<details class="graph" open>
        <summary>
        <span class="title">${subGraph.title}</span>
        ${
          this.subGraphId !== id
            ? html`<div id="graph-controls">
                <button
                  class="change-subgraph"
                  @click=${() => {
                    this.dispatchEvent(new SubGraphChosenEvent(id));
                  }}
                >
                  Change subgraph
                </button>
              </div>`
            : nothing
        }</div>
        </summary>
        ${this.#renderBoard(
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
    return html`<details class="graph" open>
      <summary>${title}</summary>
      ${this.#renderBoard(nodes, ports, subGraphs, true)}
    </details> `;
  }

  render() {
    if (!this.#graphRender) {
      return nothing;
    }

    return html`
      <div id="container">
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
