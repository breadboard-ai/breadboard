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
  inspect,
  GraphDescriptor,
  InspectableNode,
  Edge,
  Kit,
  InspectablePortList,
  NodeDescriberResult,
  Schema,
  NodeConfiguration,
} from "@google-labs/breadboard";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import * as LG from "litegraph.js";
import { map } from "lit/directives/map.js";
import {
  EdgeChangeEvent,
  NodeCreateEvent,
  NodeUpdateEvent,
} from "../../events/events.js";
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

type ActiveNode = {
  editAction: "add" | "update";
  id: string;
  type: string;
  inputSchema: Schema;
  graphNode: LG.LGraphNode;
  configuration: NodeConfiguration;
};

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
  activeNode: ActiveNode | null = null;

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
  #lastGraphUrl: string | null = null;

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
      width: 100%;
      height: 100%;
      position: absolute;
    }

    #menu {
      position: absolute;
      top: 8px;
      left: 8px;
    }

    #menu ul {
      margin: 0;
      display: flex;
      flex-direction: column;
      list-style: none;
      font-size: var(--bb-text-small);
      color: #222;
      background: #fff;
      padding: calc(var(--bb-grid-size) * 2);
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
      border-radius: 12px;
    }

    #menu li {
      margin-bottom: var(--bb-grid-size);
      white-space: nowrap;
    }

    #menu input[type="radio"] {
      display: none;
    }

    #menu li.kit-item,
    #menu label {
      padding: var(--bb-grid-size) calc(var(--bb-grid-size) * 2);
      display: block;
      border-radius: 8px;
      background: #fff;
      border: 1px solid #bbb;
      border-radius: 8px;
    }

    #menu ul li:hover label {
      background: #dfdfdf;
    }

    #menu input[type="radio"]:checked ~ label {
      background: #ececec;
    }

    #menu input[type="radio"] ~ ul {
      display: none;
    }

    #menu input[type="radio"]:checked ~ ul {
      display: flex;
      flex-direction: column;
      position: absolute;
      left: calc(100% + var(--bb-grid-size));
      top: 0;
    }

    #properties {
      background: rgba(0, 0, 0, 0.05);
      position: absolute;
      height: 100%;
      right: 0;
      top: 0;
      width: 100%;
      z-index: 10;
    }

    #node-properties {
      box-sizing: border-box;
      width: max(400px, 30%);
      position: absolute;
      height: 100%;
      right: 0;
      top: 0;
      background: #fff;
      box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.24);
      display: flex;
      flex-direction: column;
    }

    #properties header {
      display: flex;
      align-items: center;
      padding: calc(var(--bb-grid-size) * 2);
      border-bottom: 1px solid rgb(227, 227, 227);
    }

    #properties h1 {
      padding: calc(var(--bb-grid-size) * 2);
      font-size: var(--bb-text-small);
      font-weight: bold;
      margin: 0;
      position: sticky;
      top: 0;
      background: rgb(255, 255, 255);
      z-index: 1;
      flex: 1;
    }

    #properties form {
      display: grid;
      font-size: var(--bb-text-small);
      overflow: auto;
    }

    #properties #fields {
      overflow: auto;
      scrollbar-gutter: stable;
    }

    #properties fieldset {
      border-radius: 8px;
      border: 1px solid #ddd;
      margin: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2)
        calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 10);
      border: var(--bb-input-fieldset-border, 1px solid rgb(200, 200, 200));
      border-radius: var(--bb-grid-size);
      position: relative;
    }

    #properties legend {
      font-weight: bold;
      display: var(--bb-input-legend-display, block);
      padding: 0 calc(var(--bb-grid-size) * 2);
    }

    #properties label {
      grid-column: 1/3;
      font-family: var(--bb-font-family);
      font-size: var(--bb-text-small);
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2) 0 0;
    }

    #properties div[contenteditable] {
      border-radius: var(
        --bb-input-border-radius,
        calc(var(--bb-grid-size) * 3)
      );
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
    }

    #properties .configuration-item {
      margin-bottom: calc(var(--bb-grid-size) * 2);
    }

    #properties input[type="submit"] {
      background: rgb(209, 203, 255);
      border-radius: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-text-small);
      font-weight: bold;
      height: calc(var(--bb-grid-size) * 5);
      border: none;
      padding: 0 var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
    }

    #properties .cancel {
      width: 24px;
      height: 24px;
      font-size: 0;
      border: none;
      background: no-repeat center center var(--bb-icon-close);
    }

    #form-controls {
      display: grid;
      column-gap: calc(var(--bb-grid-size) * 2);
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

    graphCanvas.onShowNodePanel = async (node) => {
      const activeNode = this.#getInspectableNodeFromGraphNodeIndex(node);
      if (!activeNode) {
        return;
      }

      const { inputSchema } = await activeNode.describe();
      this.activeNode = {
        editAction: "update",
        id: activeNode.descriptor.id,
        type: activeNode.descriptor.type,
        inputSchema,
        graphNode: node,
        configuration: activeNode.configuration(),
      };
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

    if (this.#lastGraphUrl !== descriptor.url) {
      this.#nodeLocations.clear();
    }
    this.#lastGraphUrl = descriptor.url || null;

    const addIOtoNode = (
      graphNode: LG.LGraphNode,
      schemaType: "input" | "output",
      portList: InspectablePortList
    ) => {
      for (const port of portList.ports) {
        const name = port.name;
        const value = port.schema || {};
        const type =
          typeof value.type === "string" &&
          LG.LGraph.supported_types.includes(value.type)
            ? value.type
            : 0;

        const extraInfo = value.title ? { label: value.title } : undefined;

        // We appease the types here, which don't currently match. They say that
        // a type must be a valid one or -1. However, the docs suggest a value
        // of 0 is also valid.
        if (schemaType === "input") {
          const input = graphNode.addInput(name, type as -1, extraInfo);
          input.color_on = "#c9daf8";
        } else {
          const output = graphNode.addOutput(name, type as -1, extraInfo);
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

    const breadboardGraph = inspect(descriptor, { kits: this.kits });
    // TODO: Remove once all the kit bits are settled.
    // For now, this is a good way to inspect all the kits.
    console.group("Kit inspection");
    for (const kit of breadboardGraph.kits()) {
      console.groupCollapsed(`Kit: ${kit.descriptor.title}`);
      for (const nodeType of kit.nodeTypes) {
        console.group("type", nodeType.type());
        console.log("ports", await nodeType.ports());
        console.groupEnd();
      }
      console.groupEnd();
    }
    console.groupEnd();
    this.#nodes = breadboardGraph.nodes();

    // Create nodes first.
    for (let i = this.#nodes.length - 1; i >= 0; i--) {
      const node = this.#nodes[i];
      const title = `${node.descriptor.type} (${node.descriptor.id})`;
      const graphNode = this.#createNode(node.descriptor.type, title, x, y);
      this.#graph.add(graphNode);

      this.#nodeIdToGraphIndex.set(node.descriptor.id, graphNode.id);
      this.#graphIndexToNodeIndex.set(graphNode.id, i);

      const { inputs, outputs } = await node.ports();
      addIOtoNode(graphNode, "input", inputs);
      addIOtoNode(graphNode, "output", outputs);

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
    for (const edge of breadboardGraph.edges()) {
      const from = this.#nodeIdToGraphIndex.get(edge.from.descriptor.id);
      const to = this.#nodeIdToGraphIndex.get(edge.to.descriptor.id);

      if (!from || !to) {
        console.warn(
          `Unable to find node for ${edge.from.descriptor.id} or ${edge.to.descriptor.id}`
        );
        continue;
      }

      const sourceNode = this.#graph.getNodeById(from);
      const destNode = this.#graph.getNodeById(to);
      if (!sourceNode || !destNode) {
        console.warn("Unable to find source and destination nodes");
        continue;
      }

      sourceLoop: for (let o = 0; o < sourceNode.outputs.length; o++) {
        if (sourceNode.outputs[o].name !== edge.out) {
          continue;
        }

        for (let i = 0; i < destNode.inputs.length; i++) {
          if (edge.in !== destNode.inputs[i].name) {
            continue;
          }

          this.#connectNodes(sourceNode, destNode, o, i);
          break sourceLoop;
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
      if (edge.to !== shape.to || edge.in !== shape.in) {
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
    if (!data || !this.#graph) {
      console.warn("No data in dropped node");
      return;
    }

    const {
      kitItemName,
      inputSchema,
    }: { kitItemName: string; inputSchema: Schema } = JSON.parse(data);

    const nextNodeId = this.loadInfo?.graphDescriptor?.nodes.length || 1_000;
    const id = `${kitItemName}-${nextNodeId}`;
    const x = evt.pageX - this.#left + window.scrollX;
    const y = evt.pageY - this.#top - window.scrollY;

    // Store the middle of the node for later.
    this.#nodeLocations.set(id, { x, y });

    const title = `${kitItemName} (${id})`;
    const graphNode = this.#createNode(kitItemName, title, x, y);
    this.#graph.add(graphNode);

    graphNode.addInput("", "string");
    graphNode.addOutput("", "string");

    graphNode.pos[0] = x - graphNode.size[0] * 0.5;
    graphNode.pos[1] = y - graphNode.size[1] * 0.5;

    this.activeNode = {
      editAction: "add",
      id,
      type: kitItemName,
      inputSchema,
      graphNode,
      configuration: {},
    };
  }

  // TODO: Find a better way of getting the defaults for any given node.
  #getNodeMenu() {
    if (!this.editable) {
      return nothing;
    }

    const kitList = new Map<
      string,
      Map<string, Promise<NodeDescriberResult>>
    >();

    // Sort the kits by name.
    this.kits.sort((kit1, kit2) =>
      (kit1.title || "") > (kit2.title || "") ? 1 : -1
    );

    for (const kit of this.kits) {
      if (!kit.title) {
        continue;
      }

      const kitContents = new Map<string, Promise<NodeDescriberResult>>();
      for (const [name, handler] of Object.entries(kit.handlers)) {
        if (typeof handler === "object" && handler.describe) {
          kitContents.set(name, handler.describe());
        }
      }
      if (kitContents.size === 0) {
        continue;
      }

      kitList.set(kit.title, kitContents);
    }

    return html`<div id="menu">
      <form>
        <ul>
          ${map(kitList, ([kitName, kitContents]) => {
            const kitId = kitName.toLocaleLowerCase().replace(/\W/, "-");
            return html`<li>
              <input type="radio" name="selected-kit" id="${kitId}" /><label
                for="${kitId}"
                >${kitName}</label
              >
              <ul>
                ${map(kitContents, ([kitItemName, kitItem]) => {
                  const kitItemId = kitItemName
                    .toLocaleLowerCase()
                    .replace(/\W/, "-");
                  return html`<li
                    class=${classMap({
                      [kitItemId]: true,
                      ["kit-item"]: true,
                    })}
                    draggable="true"
                    @dragstart=${async (evt: DragEvent) => {
                      const { inputSchema } = await kitItem;
                      if (!evt.dataTransfer) {
                        return;
                      }
                      evt.dataTransfer.setData(
                        DATA_TYPE,
                        JSON.stringify({
                          kitItemName,
                          inputSchema,
                        })
                      );
                    }}
                  >
                    ${kitItemName}
                  </li>`;
                })}
              </ul>
            </li>`;
          })}
        </ul>
      </form>
    </div>`;
  }

  #convertActiveNodeToForm(node: ActiveNode) {
    if (!node.inputSchema.properties) {
      return html`Unable to configure node - no schema provided.`;
    }

    return html`
      <div id="fields">
        <fieldset>
          <legend>ID</legend>
          <label for="$id">ID: <label>
          <input id="$id" name="id" type="text" value="${node.id}" />
        </fieldset>
        <fieldset>
          <legend>Configuration</legend>
          ${map(
            Object.entries(node.inputSchema.properties),
            ([name, schema]) => {
              let input;
              switch (schema.type) {
                case "object": {
                  input = `Object types are not supported yet.`;
                  break;
                }

                // TODO: Fill out more types.
                default: {
                  const value =
                    node.configuration[name] ??
                    schema.examples ??
                    schema.default ??
                    "";

                  // prettier-ignore
                  input = html`<div
                    contenteditable="plaintext-only"
                    data-id="${name}"
                  >${value}</div>`;
                  break;
                }
              }

              return html`<div class="configuration-item">
                <label title="${schema.description}" for="${name}"
                  >${name}:
                </label>
                ${input}
              </div>`;
            }
          )}
        </fieldset>
      </div>`;
  }

  #onFormSubmit(evt: SubmitEvent) {
    evt.preventDefault();

    if (!(evt.target instanceof HTMLFormElement) || !this.activeNode) {
      return;
    }

    const data = new FormData(evt.target);
    for (const field of evt.target.querySelectorAll("div[contenteditable]")) {
      if (
        !(
          field instanceof HTMLDivElement &&
          field.dataset.id &&
          field.textContent
        )
      ) {
        continue;
      }

      data.set(field.dataset.id, field.textContent);
    }

    const id = data.get("id") as string;
    const nodeType = data.get("$type") as string;
    if (!(id && nodeType)) {
      console.warn("Unable to configure node - ID and type are missing");
      return;
    }

    const configuration: NodeConfiguration = structuredClone(
      this.activeNode.configuration
    );
    for (const [name, value] of data) {
      if (typeof value !== "string") {
        continue;
      }

      if (name === "id" || name === "$type") {
        continue;
      }

      configuration[name] = value;
    }

    // If the node ID has been changed, update the node location info.
    if (this.activeNode.id !== id) {
      const location = this.#nodeLocations.get(this.activeNode.id);
      if (location) {
        this.#nodeLocations.set(id, location);
        this.#nodeLocations.delete(this.activeNode.id);
      }
    }

    if (this.activeNode.editAction === "add") {
      this.dispatchEvent(new NodeCreateEvent(id, nodeType, configuration));
    } else {
      this.dispatchEvent(new NodeUpdateEvent(id, configuration));
    }

    // Close out the panel via removing the active node marker.
    this.activeNode = null;
  }

  render() {
    let activeNode: HTMLTemplateResult | symbol = nothing;
    if (this.activeNode) {
      activeNode = html`<div id="properties">
        <div id="node-properties">
          <form @submit=${this.#onFormSubmit}>
            <header>
              <button
                type="button"
                class="cancel"
                @click=${() => {
                  if (!(this.#graph && this.activeNode)) {
                    return;
                  }

                  // Remove the temporary node.
                  if (this.activeNode.editAction === "add") {
                    this.#graph.remove(this.activeNode.graphNode);
                  }

                  this.activeNode = null;
                }}
              >
                Cancel
              </button>
              <h1>
                Properties: ${this.activeNode.editAction}
                (${this.activeNode.id})
              </h1>

              <input
                type="hidden"
                name="$type"
                value="${this.activeNode.type}"
              />
              <input
                type="submit"
                value="${this.activeNode.editAction === "add"
                  ? "Add"
                  : "Update"}"
              />
            </header>
            ${this.#convertActiveNodeToForm(this.activeNode)}
          </form>
        </div>
      </div>`;
    }

    return html`<div id="nodes" ${ref(this.#container)}></div>
      ${activeNode} ${this.#getNodeMenu()}`;
  }
}
