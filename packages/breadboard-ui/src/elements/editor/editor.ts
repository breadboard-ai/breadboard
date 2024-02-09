/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  html,
  css,
  PropertyValueMap,
  HTMLTemplateResult,
  nothing,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LoadArgs } from "../../types/types.js";
import {
  Schema,
  inspectableGraph,
  GraphDescriptor,
  loadToInspect,
  InspectableNode,
  NodeConfiguration,
  Edge,
  Kit,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import * as LG from "litegraph.js";
import { map } from "lit/directives/map.js";
import { EdgeChangeEvent, NodeCreateEvent } from "../../events/events.js";
import { classMap } from "lit/directives/class-map.js";

// Not all the variables in LiteGraph are included as part of the types, so
// this is a workaround to allow TypeScript to understand the extra stuff.
type LiteGraph = typeof LG.LiteGraph;
interface ExtendedLiteGraph extends LiteGraph {
  NODE_SELECTED_TITLE_COLOR: string;
  NODE_BOX_OUTLINE_COLOR: string;
}

interface ExtendedLGraphCanvas extends LG.LGraphCanvas {
  DEFAULT_BACKGROUND_IMAGE: string;
  clear_background_color: string;
  release_link_on_empty_shows_menu: boolean;
}

interface ExtendedLGraph extends LG.LGraph {
  onNodeConnectionChange(
    changeType:
      | (typeof LG.LiteGraph)["INPUT"]
      | (typeof LG.LiteGraph)["OUTPUT"],
    target: LG.LGraphNode,
    targetSlot: number,
    source?: LG.LGraphNode,
    sourceSlot?: number
  ): void;

  on_change(): void;
}

// TODO: Use a graph layout library.
const BASE_X = 50;
const DATA_TYPE = "application/json";

@customElement("bb-editor")
export class Editor extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  @property()
  kits: Kit[] = [];

  @property()
  nodeCount = 0;

  @property()
  edgeCount = 0;

  @property()
  editable = false;

  @state()
  activeNode: InspectableNode | null = null;

  #graph: ExtendedLGraph | null = null;
  #graphCanvas: ExtendedLGraphCanvas | null = null;
  #container: Ref<HTMLDivElement> = createRef();
  #canvas = document.createElement("canvas");
  #onResizeBound = this.#onResize.bind(this);
  #onDropBound = this.#onDrop.bind(this);
  #nodeIdToGraphIndex = new Map<string, number>();
  #graphIndexToNodeIndex = new Map<number, number>();
  #processing = false;
  #width = 300;
  #height = 200;
  #top = 0;
  #left = 0;
  #nodes: InspectableNode[] | null = null;
  #nodeLocations: Map<string, { x: number; y: number }> = new Map();

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgb(244, 247, 252);
      overflow: auto;
      position: relative;
      user-select: none;
      pointer-events: auto;
      width: 100%;
      height: 100%;
      position: relative;
    }

    #properties {
      box-sizing: border-box;
      width: 30%;
      position: absolute;
      height: 100%;
      right: 0;
      top: 0;
      background: #fff;
      padding: calc(var(--bb-grid-size) * 4);
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
    }

    #nodes {
      width: 100%;
      height: 100%;
      position: absolute;
    }

    #menu {
      position: absolute;
      top: 8px;
      left: 8px;
      display: flex;
      background: #fff;
      padding: calc(var(--bb-grid-size) * 2);
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
      border-radius: 12px;
    }

    #menu ul {
      margin: 0;
      padding: 0;
      display: flex;
      list-style: none;
    }

    #menu ul li {
      margin-right: calc(var(--bb-grid-size) * 2);
      border: 1px solid #ccc;
      border-radius: 16px;
      background: #fff2cc;
      color: #222;
      border: none;
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 2);
      font-size: var(--bb-text-small);
    }

    #menu ul li.input {
      background: #c9daf8;
    }

    #menu ul li.secret {
      background: #f4cccc;
    }

    #menu ul li.output {
      background: #b6d7a8;
    }

    #menu ul li.slot,
    #menu ul li.passthrough {
      background: #ead1dc;
    }

    #menu ul li:last-of-type {
      margin-right: 0;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
    }
  `;

  reset() {
    // To be implemented.
  }

  #configureLiteGraph() {
    const LiteGraph = LG.LiteGraph as ExtendedLiteGraph;

    LiteGraph.DEFAULT_SHADOW_COLOR = "rgba(0, 0, 0, 0.1)";
    LiteGraph.CONNECTING_LINK_COLOR = "#999";
    LiteGraph.NODE_SELECTED_TITLE_COLOR = "#222";
    LiteGraph.NODE_BOX_OUTLINE_COLOR = "#555";
    LiteGraph.CONNECTING_LINK_COLOR = "red";
    LiteGraph.LINK_COLOR = "blue";
    LiteGraph.EVENT_LINK_COLOR = "green";
  }

  #registerNodeTypes() {
    LG.LiteGraph.clearRegisteredTypes();

    const basicNode = class extends LG.LGraphNode {};
    LG.LiteGraph.registerNodeType("bb/node", basicNode);
  }

  #getInspectableNodeFromGraphNodeIndex(
    node: LG.LGraphNode
  ): InspectableNode | null {
    const activeNodeIdx = this.#graphIndexToNodeIndex.get(node.id);
    if (typeof activeNodeIdx === "undefined" || !this.#nodes) {
      console.warn("Unable to find node", this.#graphIndexToNodeIndex, node.id);
      return null;
    }

    const activeNode = this.#nodes[activeNodeIdx];
    if (!activeNode) {
      console.warn("Lookup failed - node index does not exist.");
      return null;
    }

    const backRef = this.#nodeIdToGraphIndex.get(activeNode.descriptor.id);
    if (backRef !== node.id) {
      console.warn("Lookup failed - graph index does not match.");
      return null;
    }

    return activeNode;
  }

  #createGraph() {
    const graphCanvasConstructor =
      LG.LGraphCanvas as unknown as ExtendedLGraphCanvas;
    graphCanvasConstructor.DEFAULT_BACKGROUND_IMAGE = "/images/pattern.png";

    const graph: ExtendedLGraph = new LG.LGraph() as ExtendedLGraph;
    const graphCanvas = new LG.LGraphCanvas(
      this.#canvas,
      graph
    ) as ExtendedLGraphCanvas;

    graphCanvas.allow_searchbox = false;
    graphCanvas.always_render_background = false;
    graphCanvas.background_image = "/images/pattern.png";
    graphCanvas.clear_background = true;
    graphCanvas.clear_background_color = "rgb(244, 247, 252)";
    graphCanvas.connections_width = 1;
    graphCanvas.default_link_color = "#999";
    graphCanvas.ds.max_scale = 2;
    graphCanvas.ds.min_scale = 0.2;
    graphCanvas.highquality_render = false;
    graphCanvas.links_render_mode = LG.LiteGraph.STRAIGHT_LINK;
    graphCanvas.node_title_color = "#444";
    graphCanvas.release_link_on_empty_shows_menu = false;
    graphCanvas.render_canvas_border = false;
    graphCanvas.render_connections_border = false;
    graphCanvas.render_curved_connections = false;
    graphCanvas.round_radius = 4;
    graphCanvas.show_info = false;

    graphCanvas.onNodeSelected = () => {
      graphCanvas.highlighted_links = {};
    };

    graphCanvas.onShowNodePanel = (node) => {
      const activeNode = this.#getInspectableNodeFromGraphNodeIndex(node);
      if (!activeNode) {
        return;
      }

      // TODO: Show Node info.
      // this.activeNode = activeNode;
    };

    graphCanvas.onNodeMoved = (node) => {
      const activeNode = this.#getInspectableNodeFromGraphNodeIndex(node);
      if (!activeNode) {
        return;
      }

      this.#nodeLocations.set(activeNode.descriptor.id, {
        x: node.pos[0] + node.size[0] * 0.5,
        y: node.pos[1] + node.size[1] * 0.5,
      });
    };

    graph.start();
    return { graphCanvas, graph };
  }

  #createNode(type: string, title: string, x: number, y: number) {
    const newNode = LG.LiteGraph.createNode("bb/node");
    newNode.title = title;
    newNode.pos = [x, y];

    switch (type) {
      case "input":
        newNode.color = "#c9daf8";
        newNode.boxcolor = "#3c78d8";
        break;

      case "secret":
        newNode.color = "#f4cccc";
        newNode.boxcolor = "#db4437";
        break;

      case "output":
        newNode.color = "#b6d7a8";
        newNode.boxcolor = "#38761d";
        break;

      case "slot":
      case "passthrough":
        newNode.color = "#ead1dc";
        newNode.boxcolor = "#a64d79";
        break;

      default:
        newNode.color = "#fff2cc";
        newNode.boxcolor = "#ffab40";
        break;
    }

    newNode.bgcolor = "#FFF";

    return newNode;
  }

  #connectNodes(
    from: LG.LGraphNode,
    to: LG.LGraphNode,
    sourceSlot: number,
    targetSlot: number
  ) {
    const link = from.connect(sourceSlot, to, targetSlot);
    if (!link) {
      console.warn(
        `Unable to connect: ${from.title}[out: ${sourceSlot}] to ${to.title}[in: ${targetSlot}] - are the types the same?`
      );
      return;
    }

    link.color = "#999";
  }

  async #processGraph(descriptor: GraphDescriptor) {
    if (!this.#graph) {
      return;
    }

    if (this.#processing) {
      this.requestUpdate();
      return;
    }

    const addIOtoNode = (
      graphNode: LG.LGraphNode,
      schemaType: "input" | "output",
      properties: Schema["properties"]
    ) => {
      if (!properties) {
        console.warn("Subgraph does not have any schema:", graphNode.title);
        return;
      }

      for (const [name, value] of Object.entries(properties)) {
        const type =
          typeof value.type === "string" &&
          LG.LGraph.supported_types.includes(value.type)
            ? value.type
            : 0;

        // We appease the types here, which don't currently match. They say that
        // a type must be a valid one or -1. However, the docs suggest a value
        // of 0 is also valid.
        if (schemaType === "input") {
          const input = graphNode.addInput(name, type as -1);
          input.color_on = "#c9daf8";
        } else {
          const output = graphNode.addOutput(name, type as -1);
          output.color_on = "#b6d7a8";
        }
      }
    };

    this.#processing = true;
    this.#graph.clear();
    this.#nodeIdToGraphIndex.clear();
    this.#graphIndexToNodeIndex.clear();

    // Ignore graph change events during construction
    this.#graph.onNodeConnectionChange = () => void 0;

    let x = BASE_X;
    const y = this.#height / 2;

    const breadboardGraph = inspectableGraph(descriptor, { kits: this.kits });
    this.#nodes = breadboardGraph.nodes();

    // Create nodes first.
    for (let i = this.#nodes.length - 1; i >= 0; i--) {
      const node = this.#nodes[i];
      const title = `${node.descriptor.type} (${node.descriptor.id})`;
      const graphNode = this.#createNode(node.descriptor.type, title, x, y);
      this.#graph.add(graphNode);

      this.#nodeIdToGraphIndex.set(node.descriptor.id, graphNode.id);
      this.#graphIndexToNodeIndex.set(graphNode.id, i);

      if (node.isSubgraph()) {
        if (!descriptor.url) {
          console.warn("Descriptor does not have a URL");
          break;
        }

        const subgraph = await node.subgraph(
          loadToInspect(new URL(descriptor.url))
        );

        if (!subgraph) {
          console.warn("Subgraph does not have any schema");
          break;
        }

        const { inputSchema, outputSchema } = await subgraph.describe();
        addIOtoNode(graphNode, "input", inputSchema.properties);
        addIOtoNode(graphNode, "output", outputSchema.properties);
      } else {
        const describerResult = await node.describe();
        const inputs = describerResult.inputSchema.properties;
        if (inputs) {
          addIOtoNode(graphNode, "input", inputs);
        }
        const outputs = describerResult.outputSchema.properties;
        if (outputs) {
          addIOtoNode(graphNode, "output", outputs);
        }
      }

      const nodeLocation = this.#nodeLocations.get(node.descriptor.id);
      if (nodeLocation) {
        graphNode.pos[0] = nodeLocation.x - graphNode.size[0] * 0.5;
        graphNode.pos[1] = nodeLocation.y - graphNode.size[1] * 0.5;
      } else {
        // Default to vertical middle.
        graphNode.pos[0] = x;
        graphNode.pos[1] = (this.#height - graphNode.size[1]) * 0.5;

        this.#nodeLocations.set(node.descriptor.id, {
          x: graphNode.pos[0] + graphNode.size[0] * 0.5,
          y: graphNode.pos[1] + graphNode.size[1] * 0.5,
        });

        x += graphNode.size[0] + 80;
      }
    }

    // Then create connections.
    for (const node of this.#nodes) {
      for (const connection of node.outgoing()) {
        const source = this.#nodeIdToGraphIndex.get(
          connection.from.descriptor.id
        );
        const dest = this.#nodeIdToGraphIndex.get(connection.to.descriptor.id);

        if (!source || !dest) {
          console.warn(
            `Unable to find node for ${connection.from.descriptor.id} or ${connection.from.descriptor.id}`
          );
          continue;
        }

        const sourceNode = this.#graph.getNodeById(source);
        const destNode = this.#graph.getNodeById(dest);
        if (!sourceNode || !destNode) {
          console.warn("Unable to find source and destination nodes");
          continue;
        }

        // Locate the ports and connect them up. If there's a wildcard '*' then
        // match outgoing and incoming ports by name. Otherwise locate the
        // precise ports and connect those alone.
        if (connection.out === "*") {
          for (let o = 0; o < sourceNode.outputs.length; o++) {
            for (let i = 0; i < destNode.inputs.length; i++) {
              if (sourceNode.outputs[o].name === destNode.inputs[i].name) {
                this.#connectNodes(sourceNode, destNode, o, i);
              }
            }
          }
        } else {
          sourceLoop: for (let o = 0; o < sourceNode.outputs.length; o++) {
            if (sourceNode.outputs[o].name !== connection.out) {
              continue;
            }

            for (let i = 0; i < destNode.inputs.length; i++) {
              if (connection.in !== destNode.inputs[i].name) {
                continue;
              }

              this.#connectNodes(sourceNode, destNode, o, i);
              break sourceLoop;
            }
          }
        }
      }
    }

    this.#graphCanvas?.setDirty(true, true);
    this.#processing = false;

    // Notify on all further changes.
    const pendingEdgeChanges: Array<{
      destination: LG.LGraphNode;
      destinationSlot: number;
      source?: LG.LGraphNode;
      sourceSlot?: number;
    }> = [];

    this.#graph.onNodeConnectionChange = (
      changeType:
        | (typeof LG.LiteGraph)["INPUT"]
        | (typeof LG.LiteGraph)["OUTPUT"],
      destination: LG.LGraphNode,
      destinationSlot: number,
      source?: LG.LGraphNode,
      sourceSlot?: number
    ) => {
      if (!this.#graph) {
        return;
      }

      // Mouse clicks and the like will be caught by LiteGraph, which isn't
      // ideal in this case since we want to know that the user has released
      // their pointer. What we do, then, is capture a click event on the way
      // down and use that to process any pending graph changes.
      window.addEventListener(
        "click",
        () => {
          if (
            !pendingEdgeChanges.length ||
            !this.loadInfo ||
            !this.loadInfo.graphDescriptor
          ) {
            return;
          }

          for (const pendingEdgeChange of pendingEdgeChanges) {
            const { source, sourceSlot, destination, destinationSlot } =
              pendingEdgeChange;

            const destinationNode =
              this.#getInspectableNodeFromGraphNodeIndex(destination);

            if (!destinationNode) {
              console.warn(`Unable to find node for "${destination.title}"`);
              continue;
            }

            if (source && typeof sourceSlot !== "undefined") {
              // New connection.
              const sourceNode =
                this.#getInspectableNodeFromGraphNodeIndex(source);

              if (!sourceNode) {
                continue;
              }

              const from = sourceNode.descriptor.id;
              const to = destinationNode.descriptor.id;
              const outPort = source.outputs[sourceSlot].name;
              const inPort = destination.inputs[destinationSlot].name;
              this.dispatchEvent(
                new EdgeChangeEvent("add", from, outPort, to, inPort)
              );
            } else {
              // Remove existing connection.
              const edge = this.#findEdge({
                to: destinationNode.descriptor.id,
                in: destination.inputs[destinationSlot].name,
              });

              if (!edge) {
                console.warn(`Unable to find edge for "${destination.title}"`);
                return;
              }

              this.dispatchEvent(
                new EdgeChangeEvent(
                  "remove",
                  edge.from,
                  edge.out || "",
                  edge.to,
                  edge.in || ""
                )
              );
            }
          }

          pendingEdgeChanges.length = 0;
        },
        {
          capture: true,
          once: true,
        }
      );

      if (changeType !== LG.LiteGraph.INPUT) {
        return;
      }

      pendingEdgeChanges.push({
        destination,
        destinationSlot,
        source,
        sourceSlot,
      });
    };
  }

  #findEdge(shape: {
    to: string;
    in: string;
    from?: string;
    out?: string;
  }): Edge | null {
    if (!this.loadInfo || !this.loadInfo.graphDescriptor) {
      return null;
    }

    for (const edge of this.loadInfo.graphDescriptor.edges) {
      if (edge.to !== shape.to && edge.in !== shape.in) {
        continue;
      }

      if (shape.from && edge.from !== shape.from) {
        continue;
      }

      if (shape.out && edge.out !== shape.out) {
        continue;
      }
      return edge;
    }

    return null;
  }

  #onResize() {
    const dPR = window.devicePixelRatio;
    const bounds = this.getBoundingClientRect();
    this.#width = bounds.width;
    this.#height = bounds.height;
    this.#top = bounds.top;
    this.#left = bounds.left;

    this.#canvas.width = this.#width * dPR;
    this.#canvas.height = this.#height * dPR;
    this.#canvas.style.width = "100%";
    this.#canvas.style.height = "100%";
    this.#canvas.getContext("2d")?.scale(dPR, dPR);

    this.#graphCanvas?.draw(true, true);
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("resize", this.#onResizeBound);
    this.addEventListener("drop", this.#onDropBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.#onResizeBound);
    this.removeEventListener("drop", this.#onDropBound);
  }

  firstUpdated(): void {
    this.#configureLiteGraph();
    this.#registerNodeTypes();
    this.#onResizeBound();

    const { graph, graphCanvas } = this.#createGraph();
    this.#graph = graph;
    this.#graphCanvas = graphCanvas;

    this.#container.value?.appendChild(this.#canvas);
  }

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{
          loadInfo: LoadArgs;
          nodeCount: number;
          edgeCount: number;
        }>
      | Map<PropertyKey, unknown>
  ): void {
    const shouldProcessGraph =
      changedProperties.has("loadInfo") ||
      changedProperties.has("nodeCount") ||
      changedProperties.has("edgeCount");
    if (shouldProcessGraph && this.loadInfo && this.loadInfo.graphDescriptor) {
      this.#processGraph(this.loadInfo.graphDescriptor);
    }
  }

  #onDrop(evt: DragEvent) {
    evt.preventDefault();

    const data = evt.dataTransfer?.getData(DATA_TYPE);
    if (!data) {
      console.warn("No data in dropped node");
      return;
    }

    const nextNodeId = this.loadInfo?.graphDescriptor?.nodes.length || 1_000;
    const id = `node-${nextNodeId}`;
    this.#nodeLocations.set(id, {
      x: evt.pageX - this.#left + window.scrollX,
      y: evt.pageY - this.#top - window.scrollY,
    });

    const nodeData: { type: string; configuration: NodeConfiguration } =
      JSON.parse(data);
    this.dispatchEvent(
      new NodeCreateEvent(id, nodeData.type, nodeData.configuration)
    );
  }

  // TODO: Find a better way of getting the defaults for any given node.
  #getNodeMenu() {
    if (!this.editable) {
      return nothing;
    }

    const items = new Map<string, NodeConfiguration>();
    items.set("invoke", { path: "gemini-generator.json" });
    items.set("input", {
      configuration: {
        schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              title: "Prompt",
              description: "The prompt to generate a completion for",
              examples: ["Tell me a fun story about playing with breadboards"],
            },
          },
          required: ["text"],
        },
      },
    });

    items.set("output", {
      configuration: {
        schema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              title: "Response",
              description: "The completion generated by the LLM",
            },
          },
          required: ["text"],
        },
      },
    });

    return html`<div id="menu">
      <ul>
        ${map(items, ([name, configuration]) => {
          return html`<li
            class=${classMap({ [name]: true })}
            draggable="true"
            @dragstart=${(evt: DragEvent) => {
              if (!evt.dataTransfer) {
                return;
              }
              evt.dataTransfer.setData(
                DATA_TYPE,
                JSON.stringify({ type: name, configuration })
              );
            }}
          >
            ${name}
          </li>`;
        })}
      </ul>
    </div>`;
  }

  render() {
    let properties: HTMLTemplateResult | symbol = nothing;
    if (this.activeNode) {
      properties = html`<div id="properties">
        <textarea>${JSON.stringify(this.activeNode, null, 2)}</textarea>
      </div>`;
    }

    return html`<div id="nodes" ${ref(this.#container)}></div>
      ${properties} ${this.#getNodeMenu()}`;
  }
}
