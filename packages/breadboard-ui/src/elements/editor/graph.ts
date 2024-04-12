/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableEdge,
  InspectableEdgeType,
  InspectableNode,
  InspectableNodePorts,
  PortStatus,
} from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import * as Dagre from "@dagrejs/dagre";
import { GraphEdge } from "./graph-edge.js";
import { GraphNode } from "./graph-node.js";
import { GraphNodePort } from "./graph-node-port.js";
import { GRAPH_OPERATIONS, GraphNodePortType } from "./types.js";

function edgeToString(edge: InspectableEdge): string {
  return `${edge.from.descriptor.id}:${edge.out}->${edge.to.descriptor.id}:${edge.in}`;
}

type LayoutInfo = { x: number; y: number; justAdded?: boolean };

export class Graph extends PIXI.Container {
  #isDirty = true;
  #edgeContainer = new PIXI.Container();
  #edgeGraphics = new Map<string, GraphEdge>();
  #edges: InspectableEdge[] | null = null;
  #nodes: InspectableNode[] | null = null;
  #ports: Map<string, InspectableNodePorts> | null = null;
  #nodeById = new Map<string, GraphNode>();
  #layout = new Map<string, LayoutInfo>();
  #highlightedNodeId: string | null = null;
  #highlightedNode = new PIXI.Graphics();
  #highlightedNodeColor = 0x0084ff;
  #highlightPadding = 8;
  #editable = false;

  layoutRect: DOMRectReadOnly | null = null;

  constructor() {
    super();

    this.eventMode = "static";
    this.sortableChildren = true;

    let lastHoverPort: GraphNodePort | null = null;
    let nodePortBeingEdited: GraphNodePort | null = null;
    let nodePortType: GraphNodePortType | null = null;
    let nodeBeingEdited: GraphNode | null = null;
    let edgeBeingEdited: GraphEdge | null = null;
    let originalEdgeDescriptor: InspectableEdge | null = null;
    let visibleOnNextMove = false;

    this.addEventListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      evt.stopPropagation();

      if (evt.target instanceof GraphNode) {
        evt.target.selected = true;

        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_DETAILS_REQUESTED, evt.target.id);

        for (const child of this.children) {
          if (
            !(child instanceof GraphNode) ||
            child === evt.target ||
            !child.selected
          ) {
            continue;
          }

          child.selected = false;
        }
        return;
      }

      if (!this.editable) {
        return;
      }

      if (evt.target instanceof GraphNodePort) {
        nodePortBeingEdited = evt.target;
        nodeBeingEdited = evt.target.parent as GraphNode;
        nodePortBeingEdited.overrideStatus = PortStatus.Connected;

        switch (nodePortBeingEdited.type) {
          case GraphNodePortType.OUT: {
            originalEdgeDescriptor = {
              from: { descriptor: { id: nodeBeingEdited.name } },
              to: { descriptor: { id: nodeBeingEdited.name } },
              out: nodePortBeingEdited.name,
              in: "*",
            } as InspectableEdge;

            edgeBeingEdited = this.#createTemporaryEdge(originalEdgeDescriptor);
            if (!edgeBeingEdited) {
              return;
            }
            nodePortType = GraphNodePortType.IN;
            break;
          }

          case GraphNodePortType.IN: {
            edgeBeingEdited = this.findEdge(
              nodeBeingEdited.name || "",
              nodePortBeingEdited
            );

            nodePortType = GraphNodePortType.IN;
            if (!edgeBeingEdited) {
              originalEdgeDescriptor = {
                from: { descriptor: { id: nodeBeingEdited.name } },
                to: { descriptor: { id: nodeBeingEdited.name } },
                out: "*",
                in: nodePortBeingEdited.name,
              } as InspectableEdge;

              edgeBeingEdited = this.#createTemporaryEdge(
                originalEdgeDescriptor
              );
              if (!edgeBeingEdited) {
                nodePortType = null;
                nodePortBeingEdited = null;
                nodeBeingEdited = null;
                break;
              }
              nodePortType = GraphNodePortType.OUT;
            }

            originalEdgeDescriptor = structuredClone(edgeBeingEdited.edge);
            break;
          }
        }

        if (!edgeBeingEdited || !edgeBeingEdited.temporary) {
          return;
        }

        // Hide the edge initially.
        visibleOnNextMove = false;
        edgeBeingEdited.visible = false;
      }
    });

    this.addEventListener(
      "globalpointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!edgeBeingEdited || !nodeBeingEdited || !originalEdgeDescriptor) {
          return;
        }

        if (!edgeBeingEdited.edge) {
          console.warn("Unable to update temporary edge value");
          return;
        }

        if (visibleOnNextMove) {
          edgeBeingEdited.forceRedraw();
          edgeBeingEdited.visible = true;
        }

        const topTarget = evt.path[evt.path.length - 1];

        if (
          topTarget instanceof GraphNodePort &&
          topTarget.type === nodePortType &&
          visibleOnNextMove
        ) {
          // Snap to nearest port.
          topTarget.overrideStatus = PortStatus.Connected;
          lastHoverPort = topTarget;

          const nodeBeingTargeted = topTarget.parent as GraphNode;

          if (nodePortType === GraphNodePortType.IN) {
            edgeBeingEdited.toNode = nodeBeingTargeted;
            edgeBeingEdited.edge.in = topTarget.name || "";
            edgeBeingEdited.edge.to = {
              descriptor: { id: nodeBeingTargeted.name },
            } as InspectableNode;
          } else {
            edgeBeingEdited.fromNode = nodeBeingTargeted;
            edgeBeingEdited.edge.out = topTarget.name || "";
            edgeBeingEdited.edge.from = {
              descriptor: { id: nodeBeingTargeted.name },
            } as InspectableNode;
          }

          edgeBeingEdited.overrideColor = 0xffa500;
          edgeBeingEdited.overrideInLocation = null;
          edgeBeingEdited.overrideOutLocation = null;
        } else {
          // Track mouse.
          if (nodePortType === GraphNodePortType.IN) {
            edgeBeingEdited.toNode = nodeBeingEdited;
            edgeBeingEdited.edge.in = originalEdgeDescriptor.in;
            edgeBeingEdited.edge.to = originalEdgeDescriptor.to;

            if (!edgeBeingEdited.overrideInLocation) {
              edgeBeingEdited.overrideInLocation =
                nodeBeingEdited.position.clone();
            }

            nodeBeingEdited.toLocal(
              evt.global,
              undefined,
              edgeBeingEdited.overrideInLocation
            );
          } else {
            edgeBeingEdited.fromNode = nodeBeingEdited;
            edgeBeingEdited.edge.out = originalEdgeDescriptor.out;
            edgeBeingEdited.edge.from = originalEdgeDescriptor.from;

            if (!edgeBeingEdited.overrideOutLocation) {
              edgeBeingEdited.overrideOutLocation =
                nodeBeingEdited.position.clone();
            }

            nodeBeingEdited.toLocal(
              evt.global,
              undefined,
              edgeBeingEdited.overrideOutLocation
            );
          }

          edgeBeingEdited.overrideColor = 0xffcc00;

          if (lastHoverPort) {
            lastHoverPort.overrideStatus = null;
            lastHoverPort = null;
          }

          if (!visibleOnNextMove) {
            visibleOnNextMove = true;
          }
        }

        edgeBeingEdited.forceRedraw();
      }
    );

    const onPointerUp = (evt: PIXI.FederatedPointerEvent) => {
      if (!edgeBeingEdited || !edgeBeingEdited.edge) {
        return;
      }

      const topTarget = evt.path[evt.path.length - 1];

      // Take a copy of the info we need.
      const targetNodePort = nodePortBeingEdited;
      const targetEdge = edgeBeingEdited;
      const targetEdgeDescriptor = structuredClone(
        targetEdge.edge
      ) as InspectableEdge;
      const edgeKey = edgeToString(targetEdgeDescriptor);

      // Clean all the variables.
      nodePortBeingEdited = null;
      nodeBeingEdited = null;
      edgeBeingEdited = null;
      visibleOnNextMove = false;

      // Process the edge.
      if (
        !(topTarget instanceof GraphNodePort) ||
        topTarget.type !== nodePortType
      ) {
        // Temporary edges don't need to be sent out to the Editor API.
        if (targetEdge.temporary) {
          if (targetNodePort) {
            targetNodePort.overrideStatus = null;
          }

          this.#cleanEdges();
          return;
        }

        this.emit(GRAPH_OPERATIONS.GRAPH_EDGE_DETACH, targetEdgeDescriptor);
        return;
      }

      const existingEdge = this.#edgeGraphics.get(edgeKey);
      if (existingEdge) {
        return;
      }

      if (evt.metaKey) {
        // TODO: Export InspectableEdgeType as non-type?
        targetEdgeDescriptor.type = "constant" as InspectableEdgeType.Constant;
      }

      if (targetEdge.temporary) {
        this.emit(GRAPH_OPERATIONS.GRAPH_EDGE_ATTACH, targetEdgeDescriptor);
        return;
      } else if (originalEdgeDescriptor) {
        this.emit(
          GRAPH_OPERATIONS.GRAPH_EDGE_CHANGE,
          originalEdgeDescriptor,
          targetEdgeDescriptor
        );
        return;
      }

      console.warn("Unable to update edge");
    };

    this.addEventListener("pointerup", onPointerUp);
    this.addEventListener("pointerupoutside", onPointerUp);

    // TODO: Add layout reset option.
  }

  deselectAllChildren() {
    for (const child of this.children) {
      if (!(child instanceof GraphNode) || !child.selected) {
        continue;
      }

      child.selected = false;
    }

    this.emit(GRAPH_OPERATIONS.GRAPH_NODE_DETAILS_REQUESTED, null);
  }

  getNodeLayoutPositions() {
    return new Map(this.#layout);
  }

  clearNodeLayoutPositions() {
    this.#layout.clear();
  }

  setNodeLayoutPosition(
    node: string,
    position: PIXI.IPointData,
    justAdded = false
  ) {
    this.#layout.set(node, { ...this.toLocal(position), justAdded });
  }

  layout() {
    if (!this.#edges) {
      return;
    }

    const g = new Dagre.graphlib.Graph();
    const opts: Partial<Dagre.GraphLabel> = {
      ranksep: 60,
      rankdir: "LR",
      align: "DR",
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

        const { x, y, width, height } = g.node(id);
        this.#layout.set(id, { x: x - width / 2, y: y - height / 2 });
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
    super.render(renderer);

    if (this.#isDirty) {
      this.#isDirty = false;
      this.#drawEdges();
      this.#drawNodes();
      this.#drawNodeHighlight();
    }
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

  #onChildMoved(
    this: { graph: Graph; id: string },
    x: number,
    y: number,
    hasSettled: boolean
  ) {
    this.graph.setNodeLayoutPosition(this.id, this.graph.toGlobal({ x, y }));

    this.graph.#drawEdges();
    this.graph.#drawNodeHighlight();

    if (!hasSettled) {
      return;
    }

    // Propagate the move event out to the graph renderer when the cursor is released.
    this.graph.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.id, x, y);
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
        width: this.#highlightPadding - 2,
        color: this.#highlightedNodeColor,
        alpha: 0.25,
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
      graphNode.once(GRAPH_OPERATIONS.GRAPH_NODE_DRAWN, renderNodeHighlight);
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
    const onDraw = function (this: {
      graphNode: GraphNode;
      layout: LayoutInfo | null;
    }) {
      nodesLeftToDraw--;

      // Freshly added nodes are auto-selected and repositioned to the middle
      // of the drop location.
      if (this.layout && this.layout.justAdded) {
        this.layout.x -= this.graphNode.width / 2;
        this.layout.y -= this.graphNode.height / 2;
        this.layout.justAdded = false;

        this.graphNode.selected = true;
        this.graphNode.position.set(this.layout.x, this.layout.y);
        this.graphNode.parent.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_DETAILS_REQUESTED,
          this.graphNode.name
        );
      }

      if (nodesLeftToDraw === 0) {
        this.graphNode.parent.emit(GRAPH_OPERATIONS.GRAPH_DRAW);

        if (isInitialDraw) {
          this.graphNode.parent.emit(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW);
        }
      }
    };

    for (const node of this.#nodes) {
      const { id } = node.descriptor;
      let graphNode = this.#nodeById.get(id);
      if (!graphNode) {
        graphNode = new GraphNode(id, node.descriptor.type, node.title());
        graphNode.editable = this.editable;

        this.#nodeById.set(id, graphNode);
      }

      if (node.descriptor.metadata?.visual) {
        const { x, y } = node.descriptor.metadata.visual as {
          x: number;
          y: number;
        };

        const pos = this.toGlobal({ x, y });
        this.setNodeLayoutPosition(id, pos);
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
      graphNode.removeAllListeners();
      graphNode.addPointerEventListeners();
      graphNode.on(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.#onChildMoved, {
        graph: this,
        id,
      });

      graphNode.once(GRAPH_OPERATIONS.GRAPH_NODE_DRAWN, onDraw, {
        graphNode,
        layout: this.#layout.get(id) || null,
      });
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
  #createTemporaryEdge(edge: InspectableEdge): GraphEdge | null {
    const fromNode = this.#nodeById.get(edge.from.descriptor.id);
    const toNode = this.#nodeById.get(edge.to.descriptor.id);

    if (!(fromNode && toNode)) {
      return null;
    }

    const edgeGraphic = new GraphEdge(fromNode, toNode, true);
    edgeGraphic.edge = edge;
    this.#edgeGraphics.set("__Temporary_Edge", edgeGraphic);
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
        edgeGraphic.type = edge.type;

        this.#edgeGraphics.set(edgeToString(edge), edgeGraphic);
        this.#edgeContainer.addChild(edgeGraphic);
      }

      edgeGraphic.edge = edge;
    }

    this.#cleanEdges();

    this.addChildAt(this.#edgeContainer, 0);
  }

  #cleanEdges() {
    if (!this.#edges) {
      return;
    }

    // If there's a mismatch of sizes it likely means an edge has been removed
    // so find that edge and dispose of it.
    if (this.#edgeGraphics.size === this.#edges.length) {
      return;
    }

    for (const [edgeDescription, edgeGraphic] of this.#edgeGraphics) {
      if (this.#edges.find((edge) => edgeToString(edge) === edgeDescription)) {
        continue;
      }

      edgeGraphic.clear();
      edgeGraphic.removeFromParent();
      edgeGraphic.destroy();
      this.#edgeGraphics.delete(edgeDescription);
    }
  }
}
