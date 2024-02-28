/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableEdge,
  InspectableNode,
  InspectableNodePorts,
} from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import * as Dagre from "@dagrejs/dagre";
import { GraphEdge } from "./graph-edge.js";
import { GraphNode } from "./graph-node.js";
import { InteractionTracker } from "./interaction-tracker.js";
import { GraphNodePort } from "./graph-node-port.js";
import {
  GRAPH_DRAW,
  GRAPH_INITIAL_DRAW,
  GRAPH_NODE_DRAWN,
  GRAPH_NODE_MOVED,
  GraphNodePortType,
} from "./types.js";

function edgeToString(edge: InspectableEdge): string {
  return `${edge.from.descriptor.id}:${edge.out}->${edge.to.descriptor.id}:${edge.in}`;
}

export class Graph extends PIXI.Container {
  #isDirty = true;
  #edgeContainer = new PIXI.Container();
  #edgeGraphics = new Map<string, GraphEdge>();
  #edges: InspectableEdge[] | null = null;
  #nodes: InspectableNode[] | null = null;
  #ports: Map<string, InspectableNodePorts> | null = null;
  #nodeById = new Map<string, GraphNode>();
  #layout = new Map<string, { x: number; y: number; pendingSize?: boolean }>();
  #highlightedNodeId: string | null = null;
  #highlightedNode = new PIXI.Graphics();
  #highlightedNodeColor = 0xff04a4;
  #highlightPadding = 8;
  #editable = false;

  layoutRect: DOMRectReadOnly | null = null;

  constructor() {
    super();

    this.eventMode = "static";
    this.sortableChildren = true;

    this.on("pointerdown", () => {
      InteractionTracker.instance().activeGraph = this;
    });

    // TODO: Add layout reset option.
  }

  setNodeLayoutPosition(
    node: string,
    position: PIXI.IPointData,
    pendingSize = true
  ) {
    this.#layout.set(node, { ...this.toLocal(position), pendingSize });
  }

  layout() {
    if (!this.#edges) {
      return;
    }

    const g = new Dagre.graphlib.Graph();
    const opts: Partial<Dagre.GraphLabel> = {
      marginx: 0,
      marginy: 0,
      rankdir: "LR",
      align: "UL",
    };
    if (this.layoutRect) {
      opts.width = Math.floor(this.layoutRect.width);
      opts.height = Math.floor(this.layoutRect.height);
    }

    g.setGraph(opts);
    g.setDefaultEdgeLabel(() => ({}));

    let nodesAdded = 0;
    for (const node of this.children) {
      if (!(node instanceof GraphNode)) {
        continue;
      }

      // Skip any nodes where the layout has already been set by the user.
      if (this.#layout.has(node.id)) {
        continue;
      }
      nodesAdded++;
      g.setNode(node.id, node.dimensions);
    }

    let edgesAdded = 0;
    for (const edge of this.#edges) {
      edgesAdded++;
      g.setEdge(edge.from.descriptor.id, edge.to.descriptor.id);
    }

    // Only run Dagre if there are edges & children to account for. Otherwise
    // it will throw an error.
    if (nodesAdded > 0 && edgesAdded > 0) {
      Dagre.layout(g);

      for (const id of g.nodes()) {
        const data = g.node(id);
        if (!data) {
          continue;
        }

        const { x, y } = g.node(id);
        this.#layout.set(id, { x, y });
      }
    }

    // Step through any Dagre-set and custom set locations.
    for (const [id, position] of this.#layout) {
      const graphNode = this.#nodeById.get(id);
      if (!graphNode) {
        continue;
      }

      graphNode.position.set(position.x, position.y);
    }

    this.#drawEdges();
  }

  render(renderer: PIXI.Renderer) {
    if (this.#isDirty) {
      this.#isDirty = false;
      this.#drawEdges();
      this.#drawNodes();
      this.#drawNodeHighlight();
    }

    super.render(renderer);
  }

  set editable(editable: boolean) {
    const nodes = this.children;
    for (const node of nodes) {
      if (!(node instanceof GraphNode)) {
        continue;
      }

      node.editable = editable;
    }
    this.#editable = editable;
  }

  get editable() {
    return this.#editable;
  }

  set edges(edges: InspectableEdge[] | null) {
    // Validate the edges.
    this.#edges = edges?.filter((edge) => edge.to && edge.from) || null;
    this.#isDirty = true;
  }

  get edges() {
    return this.#edges;
  }

  set nodes(nodes: InspectableNode[] | null) {
    this.#nodes = nodes;
    this.#isDirty = true;
  }

  get nodes() {
    return this.#nodes;
  }

  set ports(ports: Map<string, InspectableNodePorts> | null) {
    this.#ports = ports;
    this.#isDirty = true;
  }

  get ports() {
    return this.#ports;
  }

  set highlightedNodeId(highlightedNodeId: string | null) {
    this.#highlightedNodeId = highlightedNodeId;
    this.#drawNodeHighlight();
  }

  get highlightedNodeId() {
    return this.#highlightedNodeId;
  }

  findEdge(id: string, port: GraphNodePort): GraphEdge | null {
    if (!this.#edges) {
      return null;
    }

    const predicateForInputPorts = (edge: InspectableEdge) =>
      edge.to.descriptor.id === id && edge.in === port.name;
    const predicateForOutputPorts = (edge: InspectableEdge) =>
      edge.from.descriptor.id === id && edge.out === port.name;

    const edge = this.#edges.find(
      port.type === GraphNodePortType.IN
        ? predicateForInputPorts
        : predicateForOutputPorts
    );

    if (!edge) {
      return null;
    }

    return this.#edgeGraphics.get(edgeToString(edge)) || null;
  }

  #onChildMoved(this: { graph: Graph; id: string }, x: number, y: number) {
    this.graph.setNodeLayoutPosition(
      this.id,
      this.graph.toGlobal({ x, y }),
      false
    );

    this.graph.#drawEdges();
    this.graph.#drawNodeHighlight();
  }

  #drawNodeHighlight() {
    if (!this.#nodeById) {
      return;
    }

    if (!this.#highlightedNodeId) {
      this.#highlightedNode.clear();
      return;
    }

    const graphNode = this.#nodeById.get(this.#highlightedNodeId);
    if (!graphNode) {
      this.#highlightedNode.clear();
      return;
    }

    const renderNodeHighlight = () => {
      if (graphNode.width === 0 || graphNode.height === 0) {
        return;
      }

      const { width, height } = graphNode.dimensions;
      this.#highlightedNode.clear();
      this.#highlightedNode.lineStyle({
        width: 5,
        color: this.#highlightedNodeColor,
        alpha: 0.4,
      });
      this.#highlightedNode.drawRoundedRect(
        graphNode.x - this.#highlightPadding,
        graphNode.y - this.#highlightPadding,
        width + this.#highlightPadding * 2,
        height + this.#highlightPadding * 2,
        graphNode.borderRadius + this.#highlightPadding
      );

      this.addChild(this.#highlightedNode);
    };

    // It's possible this will be called before the graph node has rendered, so
    // if that happens wait for the draw event to fire then try again.
    if (graphNode.width === 0 && graphNode.height === 0) {
      graphNode.once(GRAPH_NODE_DRAWN, renderNodeHighlight);
    } else {
      renderNodeHighlight();
    }
  }

  #drawNodes() {
    if (!this.#nodes || !this.#ports) {
      return;
    }

    /**
     * We only position the graph on the initial draw, and we need the graph to
     * be drawn before we can query its dimensions. So we check the layout map,
     * which should only be empty on the first render. We then track each node
     * render, and when all have drawn we notify the graph itself that it can
     * centralize the graph.
     */
    const isInitialDraw = this.#layout.size === 0;
    let nodesLeftToDraw = this.#nodes.length;
    const onDraw = function (this: GraphNode) {
      nodesLeftToDraw--;

      if (nodesLeftToDraw === 0) {
        this.parent.emit(GRAPH_DRAW);

        if (isInitialDraw) {
          this.parent.emit(GRAPH_INITIAL_DRAW);
        }
      }
    };

    const adjustLayoutForDroppedNode = function (this: {
      graphNode: GraphNode;
      layout: { x: number; y: number; pendingSize?: boolean };
    }) {
      this.layout.x -= this.graphNode.width / 2;
      this.layout.y -= this.graphNode.height / 2;
      this.layout.pendingSize = false;

      this.graphNode.position.set(this.layout.x, this.layout.y);
    };

    for (const node of this.#nodes) {
      const { id } = node.descriptor;
      let graphNode = this.#nodeById.get(id);
      if (!graphNode) {
        graphNode = new GraphNode(id, node.descriptor.type, node.title());
        graphNode.editable = this.editable;
        this.#nodeById.set(id, graphNode);

        // This is a dropped node.
        const layout = this.#layout.get(id);
        if (layout && layout.pendingSize) {
          graphNode.once(GRAPH_NODE_DRAWN, adjustLayoutForDroppedNode, {
            graphNode,
            layout,
          });
        }
      }

      const portInfo = this.#ports.get(id);
      if (!portInfo) {
        console.warn(`Unable to locate port info for ${id}`);
        continue;
      }

      graphNode.name = id;
      graphNode.inPorts = portInfo.inputs.ports;
      graphNode.outPorts = portInfo.outputs.ports;

      graphNode.forceUpdateDimensions();
      graphNode.on(GRAPH_NODE_MOVED, this.#onChildMoved, {
        graph: this,
        id,
      });

      graphNode.once(GRAPH_NODE_DRAWN, onDraw, graphNode);
      this.addChild(graphNode);
    }

    // Node has been removed - clean it up.
    if (this.#nodes.length < this.#nodeById.size) {
      for (const [id, graphNode] of this.#nodeById) {
        if (this.#nodes.find((node) => node.descriptor.id === id)) {
          continue;
        }

        graphNode.removeFromParent();
        graphNode.destroy();
        this.#nodeById.delete(id);
        this.#layout.delete(id);
      }
    }
  }

  // TODO: Merge this with below.
  createTemporaryEdge(edge: InspectableEdge): GraphEdge | null {
    const fromNode = this.#nodeById.get(edge.from.descriptor.id);
    const toNode = this.#nodeById.get(edge.to.descriptor.id);

    if (!(fromNode && toNode)) {
      return null;
    }

    const edgeGraphic = new GraphEdge(fromNode, toNode, true);
    edgeGraphic.edge = edge;
    this.#edgeContainer.addChild(edgeGraphic);

    return edgeGraphic;
  }

  #drawEdges() {
    if (!this.#edges) {
      return;
    }

    for (const edge of this.#edges) {
      let edgeGraphic = this.#edgeGraphics.get(edgeToString(edge));
      if (!edgeGraphic) {
        const fromNode = this.#nodeById.get(edge.from.descriptor.id);
        const toNode = this.#nodeById.get(edge.to.descriptor.id);

        // Only create the edge when the nodes are present.
        if (!(fromNode && toNode)) {
          continue;
        }
        edgeGraphic = new GraphEdge(fromNode, toNode);

        this.#edgeGraphics.set(edgeToString(edge), edgeGraphic);
        this.#edgeContainer.addChild(edgeGraphic);
      }

      edgeGraphic.edge = edge;
    }

    // If there's a mismatch of sizes it likely means an edge has been removed
    // so find that edge and dispose of it.

    if (this.#edgeGraphics.size !== this.#edges.length) {
      for (const [edgeDescription, edgeGraphic] of this.#edgeGraphics) {
        if (
          this.#edges.find((edge) => edgeToString(edge) === edgeDescription)
        ) {
          continue;
        }

        edgeGraphic.clear();
        edgeGraphic.removeFromParent();
        edgeGraphic.destroy();
        this.#edgeGraphics.delete(edgeDescription);
      }
    }

    this.addChildAt(this.#edgeContainer, 0);
  }
}
