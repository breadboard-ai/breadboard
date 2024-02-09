/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LoadArgs } from "../../types/types.js";
import {
  Schema,
  inspectableGraph,
  GraphDescriptor,
  loadToInspect,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import * as LG from "litegraph.js";

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

// TODO: Use a graph layout library.
const BASE_X = 50;

@customElement("bb-editor")
export class Editor extends LitElement {
  @property()
  loadInfo: LoadArgs | null = null;

  #graph: LG.LGraph | null = null;
  #graphCanvas: ExtendedLGraphCanvas | null = null;
  #container: Ref<HTMLDivElement> = createRef();
  #canvas = document.createElement("canvas");
  #onResizeBound = this.#onResize.bind(this);
  #nodeIdToGraphIndex = new Map<string, number>();
  #processing = false;
  #width = 300;
  #height = 200;

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

    #nodes {
      display: flex;
      flex-direction: row;
      align-items: center;
      overflow: scroll;
      width: 100%;
      height: 100%;
      position: absolute;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
    }
  `;

  reset() {
    // To be implemented...
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

  #createGraph() {
    const graphCanvasConstructor =
      LG.LGraphCanvas as unknown as ExtendedLGraphCanvas;
    graphCanvasConstructor.DEFAULT_BACKGROUND_IMAGE = "/images/pattern.png";

    const graph = new LG.LGraph();
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

    let x = BASE_X;
    const y = this.#height / 2;

    const breadboardGraph = inspectableGraph(descriptor);
    const nodes = breadboardGraph.nodes();

    // Create nodes first.
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const title = `${node.descriptor.type} (${node.descriptor.id})`;
      const graphNode = this.#createNode(node.descriptor.type, title, x, y);
      this.#graph.add(graphNode);

      this.#nodeIdToGraphIndex.set(node.descriptor.id, graphNode.id);

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
        switch (node.descriptor.type) {
          case "fetch": {
            addIOtoNode(graphNode, "input", { url: { type: "string" } });
            addIOtoNode(graphNode, "output", { response: { type: "string" } });
            break;
          }

          case "jsonata": {
            addIOtoNode(graphNode, "input", {
              json: { type: "object" },
              expression: { type: "string" },
              raw: { type: "boolean" },
            });
            break;
          }

          case "output":
          case "input": {
            if (
              !node.descriptor.configuration ||
              !node.descriptor.configuration.schema
            ) {
              console.warn("Unable to render node with no configuration");
              break;
            }

            const schema = node.descriptor.configuration.schema as Schema;
            const schemaType =
              node.descriptor.type === "input" ? "output" : "input";
            addIOtoNode(graphNode, schemaType, schema.properties);
            break;
          }
        }
      }

      // Vertical middle.
      graphNode.pos[1] = (this.#height - graphNode.size[1]) * 0.5;

      x += graphNode.size[0] + 80;
    }

    // Then create connections.
    for (const node of nodes) {
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
  }

  #onResize() {
    const dPR = window.devicePixelRatio;
    const bounds = this.getBoundingClientRect();
    this.#width = bounds.width;
    this.#height = bounds.height;

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
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.#onResizeBound);
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

  render() {
    if (this.loadInfo && this.loadInfo.graphDescriptor) {
      this.#processGraph(this.loadInfo.graphDescriptor);
    }

    return html`<div id="nodes" ${ref(this.#container)}></div>`;
  }
}
