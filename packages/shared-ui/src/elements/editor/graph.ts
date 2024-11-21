/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommentNode,
  InspectableEdge,
  InspectableEdgeType,
  InspectableNode,
  InspectableNodePorts,
  InspectablePort,
  NodeHandlerMetadata,
  PortStatus,
} from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import * as Dagre from "@dagrejs/dagre";
import { GraphEdge } from "./graph-edge.js";
import { GraphNode } from "./graph-node.js";
import { GraphNodePort } from "./graph-node-port.js";
import {
  ComponentExpansionState,
  GRAPH_OPERATIONS,
  GraphNodePortType,
  LayoutInfo,
  SideEdge,
  VisualMetadata,
} from "./types.js";
import { GraphAssets } from "./graph-assets.js";
import {
  inspectableEdgeToString,
  getGlobalColor,
  expansionStateFromMetadata,
} from "./utils.js";
import { GraphComment } from "./graph-comment.js";
import {
  ComponentWithActivity,
  EdgeData,
  TopGraphEdgeValues,
  TopGraphNodeInfo,
  cloneEdgeData,
} from "../../types/types.js";
import { getSubgraphColor } from "../../utils/subgraph-color.js";

const highlightedNodeColor = getGlobalColor("--bb-ui-600");
const nodeTextColor = getGlobalColor("--bb-neutral-900");
const nodeBorderColor = getGlobalColor("--bb-neutral-500");
const subGraphDefaultBorderColor = getGlobalColor("--bb-neutral-300");
const subGraphDefaultLabelColor = getGlobalColor("--bb-neutral-500");
const subGraphDefaultLabelTextColor = getGlobalColor("--bb-neutral-0");

const SUB_GRAPH_LABEL_TEXT_SIZE = 11;

export class Graph extends PIXI.Container {
  #isDirty = true;
  #edgeContainer = new PIXI.Container();
  #edgeGraphics = new Map<string, GraphEdge>();
  #edges: InspectableEdge[] | null = null;
  #nodes: InspectableNode[] | null = null;
  #typeMetadata: Map<string, NodeHandlerMetadata> | null = null;
  #comments: CommentNode[] | null = null;
  #ports: Map<string, InspectableNodePorts> | null = null;
  #nodeById = new Map<string, InspectableNode>();
  #graphNodeById = new Map<string, GraphNode | GraphComment>();
  #layout = new Map<string, LayoutInfo>();
  #highlightedComponent: ComponentWithActivity | null = null;
  #highlightedNode = new PIXI.Graphics();
  #highlightedNodeColor = highlightedNodeColor;
  #highlightPadding = 8;
  #autoSelect = new Set<string>();
  #subGraphOutline = new PIXI.Graphics();
  #subGraphOutlinePadding = 20;
  #latestPendingValidateRequest = new WeakMap<GraphEdge, symbol>();
  #edgeValues: TopGraphEdgeValues | null = null;
  #nodeInfo: TopGraphNodeInfo | null = null;

  #isInitialDraw = true;
  #collapseNodesByDefault = false;
  #showNodePreviewValues = false;
  #showNodeTypeDescriptions = false;
  #subGraphId: string | null = null;
  #subGraphTitle: string | null = null;
  #subGraphTitleLabel: PIXI.Text | null = null;
  #subGraphBorderColor = subGraphDefaultBorderColor;
  #subGraphLabelColor = subGraphDefaultLabelColor;
  #subGraphLabelTextColor = subGraphDefaultLabelTextColor;

  layoutRect: DOMRectReadOnly | null = null;

  readOnly = false;
  highlightInvalidWires = false;

  constructor() {
    super({
      isRenderGroup: true,
    });

    this.isRenderGroup = true;
    this.eventMode = "static";
    this.sortableChildren = true;

    // TODO: Enable subgraph selection.
    this.#subGraphOutline.eventMode = "none";

    let lastHoverPort: GraphNodePort | null = null;
    let lastHoverNode: GraphNode | null = null;
    let nodePortBeingEdited: GraphNodePort | null = null;
    let nodePortType: GraphNodePortType | null = null;
    let nodeBeingEdited: GraphNode | null = null;
    let edgeBeingEdited: GraphEdge | null = null;
    let originalEdgeDescriptor: EdgeData | null = null;
    let visibleOnNextMove = false;
    let creatingAdHocEdge = false;

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }

      this.#isDirty = false;
      this.#drawComments();
      this.#drawEdges();
      this.#drawNodes();
      this.#drawNodeHighlight();
      this.#drawSubGraphOutline();

      if (this.#autoSelect.size > 0) {
        this.#performAutoSelect();
      }
    };

    this.once("removed", () => {
      // Clean all edges.
      for (const edge of this.#edgeContainer.children) {
        edge.removeFromParent();
        edge.destroy();
      }

      // Clean all nodes.
      for (const node of this.#graphNodeById.values()) {
        node.removeFromParent();
        node.destroy();
      }

      this.#edgeGraphics.clear();
      this.#graphNodeById.clear();
      this.#layout.clear();
    });

    this.addListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      if (!evt.isPrimary) {
        return;
      }

      evt.stopPropagation();

      // Because the edge is made up the wire graphic and the value widget we
      // need to redirect clicks on the wire graphic itself to the containing
      // GraphEdge for the purposes of selection.
      if (evt.target.label === "GraphEdge" && evt.target.parent) {
        evt.target = evt.target.parent;
      }

      if (
        evt.target instanceof GraphComment ||
        evt.target instanceof GraphNode ||
        evt.target instanceof GraphEdge
      ) {
        if (!evt.metaKey && !evt.shiftKey && !evt.target.selected) {
          this.deselectAllChildren();
        }

        if (evt.target instanceof GraphEdge) {
          if (evt.target.toNode.collapsed || evt.target.fromNode.collapsed) {
            const possibleEdges = this.#edgesBetween(
              evt.target.fromNode,
              evt.target.toNode
            );

            if (possibleEdges.length === 1) {
              evt.target.selected = true;
              return;
            }

            const requestDisambiguation = () => {
              this.emit(
                GRAPH_OPERATIONS.GRAPH_EDGE_SELECT_DISAMBIGUATION_REQUESTED,
                possibleEdges,
                evt.client
              );
            };

            this.once("pointerup", requestDisambiguation);
            return;
          }
        }

        if (evt.metaKey) {
          evt.target.selected = !evt.target.selected;
        } else {
          evt.target.selected = true;
        }

        if (
          evt.target instanceof GraphNode ||
          evt.target instanceof GraphComment
        ) {
          this.emit(
            evt.target.selected
              ? GRAPH_OPERATIONS.GRAPH_NODE_SELECTED
              : GRAPH_OPERATIONS.GRAPH_NODE_DESELECTED,
            evt.target.label
          );
        }

        this.#sortChildrenBySelectedStatus();
        return;
      }

      if (this.readOnly) {
        return;
      }

      if (evt.target instanceof GraphNodePort) {
        nodePortBeingEdited = evt.target;
        nodeBeingEdited = evt.target.parent as GraphNode;
        nodePortBeingEdited.overrideStatus = PortStatus.Connected;

        switch (nodePortBeingEdited.type) {
          case GraphNodePortType.OUT: {
            originalEdgeDescriptor = {
              from: { descriptor: { id: nodeBeingEdited.label } },
              to: { descriptor: { id: nodeBeingEdited.label } },
              out: nodePortBeingEdited.label,
              in: "*",
              type: InspectableEdgeType.Ordinary,
            };

            edgeBeingEdited = this.#createTemporaryEdge(originalEdgeDescriptor);
            if (!edgeBeingEdited) {
              return;
            }
            nodePortType = GraphNodePortType.IN;
            break;
          }

          case GraphNodePortType.IN: {
            // Both nodes need to be open before a change can be made. Otherwise
            // we don't know exactly which edge is being edited.
            if (
              edgeBeingEdited &&
              (edgeBeingEdited.toNode.collapsed ||
                edgeBeingEdited.fromNode.collapsed)
            ) {
              edgeBeingEdited = null;
              return;
            }

            nodePortType = GraphNodePortType.IN;
            if (!edgeBeingEdited) {
              originalEdgeDescriptor = {
                from: { descriptor: { id: nodeBeingEdited.label } },
                to: { descriptor: { id: nodeBeingEdited.label } },
                out: "*",
                in: nodePortBeingEdited.label,
                type: InspectableEdgeType.Ordinary,
              };

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

            originalEdgeDescriptor = cloneEdgeData(edgeBeingEdited.edge);
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

    this.addListener("globalpointermove", (evt: PIXI.FederatedPointerEvent) => {
      if (
        !edgeBeingEdited ||
        !nodeBeingEdited ||
        !originalEdgeDescriptor ||
        !evt.isPrimary
      ) {
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

      const path = evt.composedPath();
      const topTarget = path[path.length - 1];
      const isSameGraph = topTarget.parent.parent === this;

      if (
        topTarget instanceof GraphNodePort &&
        topTarget.type === nodePortType &&
        isSameGraph &&
        visibleOnNextMove
      ) {
        // Snap to nearest port.
        topTarget.overrideStatus = PortStatus.Connected;
        lastHoverPort = topTarget;

        const nodeBeingTargeted = topTarget.parent as GraphNode;

        if (nodePortType === GraphNodePortType.IN) {
          edgeBeingEdited.toNode = nodeBeingTargeted;
          edgeBeingEdited.edge.in = topTarget.label || "";
          edgeBeingEdited.edge.to = {
            descriptor: { id: nodeBeingTargeted.label },
          };
        } else {
          edgeBeingEdited.fromNode = nodeBeingTargeted;
          edgeBeingEdited.edge.out = topTarget.label || "";
          edgeBeingEdited.edge.from = {
            descriptor: { id: nodeBeingTargeted.label },
          };
        }

        edgeBeingEdited.overrideColor = 0xffa500;
        edgeBeingEdited.overrideInLocation = null;
        edgeBeingEdited.overrideOutLocation = null;

        if (lastHoverNode) {
          lastHoverNode.highlightForAdHoc = false;
          creatingAdHocEdge = false;
        }
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

        // If the user drags over a node itself and it supports ad hoc edge
        // creation then highlight the target node.
        if (
          nodePortBeingEdited &&
          nodePortBeingEdited.label !== "*" &&
          nodePortBeingEdited.label !== "" &&
          topTarget instanceof GraphNode &&
          topTarget !== nodeBeingEdited &&
          isSameGraph
        ) {
          const targetAllowsAdHocPorts =
            (nodePortBeingEdited.type === GraphNodePortType.IN &&
              !topTarget.fixedOutputs) ||
            (nodePortBeingEdited.type === GraphNodePortType.OUT &&
              !topTarget.fixedInputs);

          if (targetAllowsAdHocPorts) {
            topTarget.highlightForAdHoc = true;
            creatingAdHocEdge = true;
            lastHoverNode = topTarget;
          }
        } else if (lastHoverNode) {
          lastHoverNode.highlightForAdHoc = false;
          creatingAdHocEdge = false;
        }
      }

      edgeBeingEdited.forceRedraw();
    });

    const onPointerUp = (evt: PIXI.FederatedPointerEvent) => {
      if (!edgeBeingEdited || !edgeBeingEdited.edge) {
        return;
      }

      const path = evt.composedPath();
      const topTarget = path[path.length - 1] as PIXI.Graphics;

      // Take a copy of the info we need.
      const targetNodePort = nodePortBeingEdited;
      const targetEdge = edgeBeingEdited;
      const targetEdgeDescriptor = cloneEdgeData(targetEdge.edge)!;
      const targetHoverNodeForAdHoc = lastHoverNode;

      // Clean all the variables.
      nodePortBeingEdited = null;
      nodeBeingEdited = null;
      edgeBeingEdited = null;
      visibleOnNextMove = false;
      lastHoverNode = null;

      // If the pointer target is the same at pointerdown and pointerup, the
      // user has clicked on a node port, and we should avoid creating a wire.
      if (topTarget === targetNodePort) {
        if (topTarget instanceof GraphNodePort) {
          topTarget.overrideStatus = null;
        }
        return;
      }

      let fromNode = targetEdge.fromNode;
      let toNode = targetEdge.toNode;
      let outPortDisambiguation = targetEdge.fromNode.outPorts;
      let inPortDisambiguation = targetEdge.toNode.inPorts;
      let targetInPortName = "_UNSPECIFIED_IN_PORT";
      let targetOutPortName = "_UNSPECIFIED_OUT_PORT";

      if (targetNodePort) {
        if (targetNodePort.type === GraphNodePortType.IN) {
          targetInPortName = targetNodePort.label;
          targetOutPortName = topTarget.label;
        } else {
          targetInPortName = topTarget.label;
          targetOutPortName = targetNodePort.label;
        }
      }

      if (targetHoverNodeForAdHoc) {
        targetHoverNodeForAdHoc.highlightForAdHoc = false;
        if (targetNodePort) {
          if (targetNodePort.type === GraphNodePortType.IN) {
            fromNode = targetHoverNodeForAdHoc;
            outPortDisambiguation = targetHoverNodeForAdHoc.outPorts;
          } else {
            toNode = targetHoverNodeForAdHoc;
            inPortDisambiguation = targetHoverNodeForAdHoc.inPorts;
          }
        }
      }

      let action: GRAPH_OPERATIONS | null = null;
      if (topTarget instanceof GraphNodePort) {
        if (targetEdge.temporary) {
          action = GRAPH_OPERATIONS.GRAPH_EDGE_ATTACH;
        } else if (originalEdgeDescriptor) {
          action = GRAPH_OPERATIONS.GRAPH_EDGE_CHANGE;
        }
      }

      // Update the edge if either of the nodes is collapsed.
      const fromNodePortsOut = outPortDisambiguation || [];
      const possiblePortsOut: InspectablePort[] = fromNode.collapsed
        ? fromNodePortsOut.filter(
            (port) => !port.star && port.name !== "" && port.name !== "$error"
          )
        : fromNodePortsOut.filter(
            (port) =>
              !port.star && port.name !== "" && port.name === targetOutPortName
          );

      const toNodePortsIn = inPortDisambiguation || [];
      const possiblePortsIn: InspectablePort[] = toNode.collapsed
        ? toNodePortsIn.filter((port) => {
            if (port.star) return false;
            if (port.name === "") return false;
            if (port.schema.behavior?.includes("config")) return false;
            const items = port.schema.items;
            if (
              items &&
              !Array.isArray(items) &&
              items.behavior?.includes("config")
            ) {
              return false;
            }

            return true;
          })
        : toNodePortsIn.filter(
            (port) =>
              !port.star && port.name !== "" && port.name === targetInPortName
          );

      if (action !== null && (fromNode.collapsed || toNode.collapsed)) {
        if (targetEdge.temporary) {
          this.#removeStaleEdges();
        }

        if (targetNodePort) {
          targetNodePort.overrideStatus = null;
        }

        if (topTarget instanceof GraphNodePort) {
          topTarget.overrideStatus = null;
        }

        if (
          !(topTarget instanceof GraphNodePort) ||
          topTarget === targetNodePort
        ) {
          return;
        }

        if (possiblePortsOut.length === 1 && possiblePortsIn.length === 1) {
          targetEdgeDescriptor.out = possiblePortsOut[0].name;
          targetEdgeDescriptor.in = possiblePortsIn[0].name;
        } else {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_EDGE_ADD_DISAMBIGUATION_REQUESTED,
            targetEdgeDescriptor.from.descriptor.id,
            targetEdgeDescriptor.to.descriptor.id,
            possiblePortsOut,
            possiblePortsIn,
            evt.client.clone()
          );
          return;
        }
      }

      const edgeKey = inspectableEdgeToString(targetEdgeDescriptor);
      switch (action) {
        case GRAPH_OPERATIONS.GRAPH_EDGE_ATTACH: {
          const existingEdge = this.#edgeGraphics.get(edgeKey);
          if (existingEdge) {
            break;
          }

          if (evt.metaKey) {
            targetEdgeDescriptor.type = InspectableEdgeType.Constant;
          }
          this.emit(GRAPH_OPERATIONS.GRAPH_EDGE_ATTACH, targetEdgeDescriptor);
          break;
        }

        case GRAPH_OPERATIONS.GRAPH_EDGE_CHANGE: {
          targetEdge.overrideColor = null;

          const existingEdge = this.#edgeGraphics.get(edgeKey);
          if (existingEdge) {
            break;
          }

          if (evt.metaKey) {
            targetEdgeDescriptor.type = InspectableEdgeType.Constant;
          }
          this.emit(
            GRAPH_OPERATIONS.GRAPH_EDGE_CHANGE,
            originalEdgeDescriptor,
            targetEdgeDescriptor
          );
          break;
        }

        default: {
          // Possible ad-hoc wire disambiguation.
          if (creatingAdHocEdge && targetNodePort && targetHoverNodeForAdHoc) {
            const knownPorts =
              targetNodePort.type === GraphNodePortType.OUT
                ? possiblePortsOut
                : possiblePortsIn;

            const from =
              targetNodePort.type === GraphNodePortType.OUT
                ? targetEdgeDescriptor.from.descriptor.id
                : targetHoverNodeForAdHoc.label;

            const to =
              targetNodePort.type === GraphNodePortType.IN
                ? targetEdgeDescriptor.from.descriptor.id
                : targetHoverNodeForAdHoc.label;

            if (knownPorts.length === 0) {
              break;
            }

            this.emit(
              GRAPH_OPERATIONS.GRAPH_EDGE_ADD_AD_HOC_DISAMBIGUATION_REQUESTED,
              from,
              to,
              targetNodePort.type === GraphNodePortType.OUT ? knownPorts : null,
              targetNodePort.type === GraphNodePortType.IN ? knownPorts : null,
              evt.client
            );
          }
          break;
        }
      }

      targetEdge.overrideColor = null;
      if (targetNodePort) {
        targetNodePort.overrideStatus = null;
      }

      this.#removeStaleEdges();
    };

    this.addListener("pointerup", onPointerUp);
    this.addListener("pointerupoutside", onPointerUp);
  }

  deselectAllChildren() {
    for (const child of this.children) {
      if (
        !(child instanceof GraphNode || child instanceof GraphComment) ||
        !child.selected
      ) {
        continue;
      }

      child.selected = false;
    }

    for (const edge of this.#edgeContainer.children) {
      if (!(edge instanceof GraphEdge) || !edge.selected) {
        continue;
      }

      edge.selected = false;
    }

    this.emit(GRAPH_OPERATIONS.GRAPH_NODE_DESELECTED_ALL);
  }

  selectAll() {
    for (const child of this.children) {
      if (!(child instanceof GraphNode || child instanceof GraphComment)) {
        continue;
      }

      child.selected = true;
    }

    for (const edge of this.#edgeContainer.children) {
      if (!(edge instanceof GraphEdge)) {
        continue;
      }

      edge.selected = true;
    }
  }

  selectInRect(rect: PIXI.Rectangle) {
    for (const child of this.children) {
      if (!(child instanceof GraphNode || child instanceof GraphComment)) {
        continue;
      }

      const isSelected = child.selected;
      child.selected = rect.intersects(child.getBounds(true).rectangle);
      if (isSelected !== child.selected) {
        this.emit(
          child.selected
            ? GRAPH_OPERATIONS.GRAPH_NODE_SELECTED
            : GRAPH_OPERATIONS.GRAPH_NODE_DESELECTED,
          child.label
        );
      }
    }

    for (const edge of this.#edgeContainer.children) {
      if (!(edge instanceof GraphEdge)) {
        continue;
      }

      // Cheap bounding box intersection first, and move on to the next edge if that fails.
      if (!rect.intersects(edge.getBounds(true).rectangle)) {
        edge.selected = false;
        continue;
      }

      // If the bounding boxes intersect, run the more expensive rectangle/polygon intersection.
      edge.selected = edge.intersectsRect(rect);
    }

    this.#sortChildrenBySelectedStatus();
  }

  getSelectedChildren(): Array<GraphNode | GraphComment | GraphEdge> {
    const selected = [];
    for (const node of this.children) {
      if (
        !(node instanceof GraphNode || node instanceof GraphComment) ||
        !node.selected
      ) {
        continue;
      }

      selected.push(node);
    }

    for (const edge of this.#edgeContainer.children) {
      if (!(edge instanceof GraphEdge) || !edge.selected) {
        continue;
      }

      selected.push(edge);
    }

    return selected;
  }

  #sortChildrenBySelectedStatus() {
    for (const node of this.children) {
      if (!(node instanceof GraphNode || node instanceof GraphComment)) {
        continue;
      }

      node.zIndex = node.selected ? this.children.length - 1 : 0;
    }
  }

  getNodeLayoutPositions() {
    return new Map(this.#layout);
  }

  clearNodeLayoutPositions() {
    this.#layout.clear();
  }

  getNodeLayoutPosition(node: string) {
    return this.#layout.get(node);
  }

  storeCommentLayoutPositions() {
    for (const child of this.children) {
      if (!(child instanceof GraphComment)) {
        continue;
      }

      this.setNodeLayoutPosition(
        child.label,
        "comment",
        this.toGlobal(child.position),
        child.expansionState,
        false
      );
    }
  }

  setNodeLayoutPosition(
    node: string,
    type: "comment" | "node",
    position: PIXI.PointData,
    expansionState: ComponentExpansionState,
    justAdded = false
  ) {
    this.#layout.set(node, {
      ...this.toLocal(position),
      type,
      expansionState,
      justAdded,
    });
  }

  layout() {
    if (!this.#edges) {
      return;
    }

    const g = new Dagre.graphlib.Graph();
    const opts: Partial<Dagre.GraphLabel> = {
      ranksep: 90,
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
        this.#layout.set(id, {
          x: Math.round(x - width / 2),
          y: Math.round(y - height / 2),
          type: "node",
          expansionState: this.collapseNodesByDefault
            ? "collapsed"
            : "expanded",
        });
      }
    }

    // Step through any Dagre-set and custom set locations.
    for (const [id, layout] of this.#layout) {
      const graphNode = this.#graphNodeById.get(id);
      if (!graphNode) {
        continue;
      }

      graphNode.position.set(layout.x, layout.y);
      graphNode.expansionState = layout.expansionState;
    }

    this.#drawEdges();
  }

  #setNodesCollapseState() {
    for (const child of this.children) {
      if (!(child instanceof GraphNode || child instanceof GraphComment)) {
        continue;
      }

      child.expansionState = this.collapseNodesByDefault
        ? "collapsed"
        : "expanded";
    }
  }

  #setNodesPreviewValues() {
    for (const child of this.children) {
      if (!(child instanceof GraphNode)) {
        continue;
      }

      child.showNodePreviewValues = this.showNodePreviewValues;
    }
  }

  #setNodesTypeDescriptions() {
    for (const child of this.children) {
      if (!(child instanceof GraphNode)) {
        continue;
      }

      child.showNodeTypeDescriptions = this.showNodeTypeDescriptions;
    }
  }

  set collapseNodesByDefault(collapseNodesByDefault: boolean) {
    if (collapseNodesByDefault === this.#collapseNodesByDefault) {
      return;
    }

    this.#isDirty = true;
    this.#collapseNodesByDefault = collapseNodesByDefault;
    this.#setNodesCollapseState();
  }

  get collapseNodesByDefault() {
    return this.#collapseNodesByDefault;
  }

  set showNodePreviewValues(showNodePreviewValues: boolean) {
    if (showNodePreviewValues === this.#showNodePreviewValues) {
      return;
    }

    this.#isDirty = true;
    this.#showNodePreviewValues = showNodePreviewValues;
    this.#setNodesPreviewValues();
  }

  get showNodePreviewValues() {
    return this.#showNodePreviewValues;
  }

  set showNodeTypeDescriptions(showNodeTypeDescriptions: boolean) {
    if (showNodeTypeDescriptions === this.#showNodeTypeDescriptions) {
      return;
    }

    this.#isDirty = true;
    this.#showNodeTypeDescriptions = showNodeTypeDescriptions;
    this.#setNodesTypeDescriptions();
  }

  get showNodeTypeDescriptions() {
    return this.#showNodeTypeDescriptions;
  }

  set edges(edges: InspectableEdge[] | null) {
    // Validate the edges.
    this.#edges = edges?.filter((edge) => edge.to && edge.from) || null;
    this.#isDirty = true;
  }

  get edges() {
    return this.#edges;
  }

  set edgeValues(edgeValues: TopGraphEdgeValues | null) {
    this.#edgeValues = edgeValues;
    this.#isDirty = true;
  }

  get edgeValues() {
    return this.#edgeValues;
  }

  set subGraphId(subGraphId: string | null) {
    if (subGraphId === this.#subGraphId) {
      return;
    }

    this.#subGraphId = subGraphId;

    if (subGraphId) {
      this.#subGraphBorderColor = getSubgraphColor<number>(
        subGraphId,
        "border",
        true
      );
      this.#subGraphLabelColor = getSubgraphColor<number>(
        subGraphId,
        "label",
        true
      );
      this.#subGraphLabelTextColor = getSubgraphColor<number>(
        subGraphId,
        "text",
        true
      );
    } else {
      this.#subGraphBorderColor = subGraphDefaultBorderColor;
      this.#subGraphLabelColor = subGraphDefaultLabelColor;
      this.#subGraphLabelTextColor = subGraphDefaultLabelTextColor;
    }
  }

  get subGraphId() {
    return this.#subGraphId;
  }

  set subGraphTitle(subGraphTitle: string | null) {
    if (this.#subGraphTitle && subGraphTitle === this.#subGraphTitle) {
      return;
    }
    this.#subGraphTitle = subGraphTitle;

    const text = subGraphTitle || "";
    if (!this.#subGraphTitleLabel) {
      this.#subGraphTitleLabel = new PIXI.Text({
        text,
        style: {
          fontFamily: "Arial",
          fontSize: SUB_GRAPH_LABEL_TEXT_SIZE,
          fill: this.#subGraphLabelTextColor,
          align: "left",
        },
      });
    } else {
      this.#subGraphTitleLabel.text = text;
    }

    this.#subGraphTitleLabel.visible = subGraphTitle !== null;
  }

  get subGraphTitle() {
    return this.#subGraphTitle;
  }

  set nodeInfo(nodeInfo: TopGraphNodeInfo | null) {
    this.#nodeInfo = nodeInfo;
    this.#isDirty = true;
  }

  get nodeInfo() {
    return this.#nodeInfo;
  }

  set nodes(nodes: InspectableNode[] | null) {
    this.#nodes = nodes;
    this.#isDirty = true;

    this.#nodeById.clear();
    if (!nodes) {
      return;
    }

    for (const node of nodes) {
      this.#nodeById.set(node.descriptor.id, node);
    }
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

  set comments(comments: CommentNode[] | null) {
    this.#comments = comments;
    this.#isDirty = true;
  }

  get comments() {
    return this.#comments;
  }

  set highlightedNode(node: ComponentWithActivity | null) {
    this.#highlightedComponent = node;
    this.#isDirty = true;
  }

  get highlightedNode() {
    return this.#highlightedComponent;
  }

  set typeMetadata(metadata: Map<string, NodeHandlerMetadata> | null) {
    this.#typeMetadata = metadata;
    this.#isDirty = true;
  }

  get typeMetadata() {
    return this.#typeMetadata;
  }

  selectEdge(edge: EdgeData) {
    const edgeGraphic = this.#edgeGraphics.get(inspectableEdgeToString(edge));
    if (!edgeGraphic) {
      return;
    }

    this.#edgeContainer.setChildIndex(
      edgeGraphic,
      this.#edgeContainer.children.length - 1
    );

    this.deselectAllChildren();
    edgeGraphic.selected = true;
  }

  addToAutoSelect(item: string) {
    this.#autoSelect.add(item);
  }

  #edgesBetween(from: GraphNode, to: GraphNode): InspectableEdge[] {
    if (!this.#edges) {
      return [];
    }

    const fromNode = this.#nodeById.get(from.label);
    const toNode = this.#nodeById.get(to.label);

    if (!(fromNode && toNode)) {
      return [];
    }

    return this.#edges.filter(
      (edge) => edge.from === fromNode && edge.to === toNode
    );
  }

  #onChildMoved(
    this: { graph: Graph; id: string },
    x: number,
    y: number,
    hasSettled: boolean
  ) {
    const position = this.graph.getNodeLayoutPosition(this.id);
    const delta = { x: 0, y: 0 };
    if (position) {
      delta.x = x - position.x;
      delta.y = y - position.y;
    }

    // Update all selected nodes.
    for (const child of this.graph.getSelectedChildren()) {
      if (!(child instanceof GraphNode || child instanceof GraphComment)) {
        continue;
      }

      const childPosition = this.graph.getNodeLayoutPosition(child.label);
      if (!childPosition) {
        console.log("Child has no position", child.label);
        continue;
      }

      const newPosition = {
        x: Math.round(childPosition.x + delta.x),
        y: Math.round(childPosition.y + delta.y),
      };

      this.graph.setNodeLayoutPosition(
        child.label,
        child instanceof GraphNode ? "node" : "comment",
        this.graph.toGlobal(newPosition),
        child.expansionState
      );

      if (child.label === this.id) {
        continue;
      }

      child.x = newPosition.x;
      child.y = newPosition.y;
    }

    this.graph.#drawEdges();
    this.graph.#drawNodeHighlight();
    this.graph.#drawSubGraphOutline();

    if (!hasSettled) {
      return;
    }

    // Propagate the move event out to the graph renderer when the cursor is released.
    const locations: Array<{
      id: string;
      type: "node" | "comment";
      x: number;
      y: number;
      expansionState: ComponentExpansionState;
    }> = [];
    for (const child of this.graph.getSelectedChildren()) {
      if (!(child instanceof GraphNode || child instanceof GraphComment)) {
        continue;
      }

      locations.push({
        id: child.label,
        type: child instanceof GraphNode ? "node" : "comment",
        x: child.position.x,
        y: child.position.y,
        expansionState: child.expansionState,
      });
    }

    this.graph.emit(GRAPH_OPERATIONS.GRAPH_NODES_MOVED, locations);
  }

  #performAutoSelect() {
    for (const graphEdge of this.#edgeContainer.children) {
      if (!(graphEdge instanceof GraphEdge)) {
        continue;
      }

      if (!graphEdge.edge) {
        continue;
      }

      const edgeDescriptor = inspectableEdgeToString(graphEdge.edge);
      if (this.#autoSelect.has(edgeDescriptor)) {
        graphEdge.selected = true;
        this.#autoSelect.delete(edgeDescriptor);
      }
    }

    for (const graphNode of this.children) {
      if (
        !(graphNode instanceof GraphNode || graphNode instanceof GraphComment)
      ) {
        continue;
      }

      if (this.#autoSelect.has(graphNode.label)) {
        graphNode.selected = true;
        this.#autoSelect.delete(graphNode.label);
      }
    }

    this.emit(GRAPH_OPERATIONS.GRAPH_AUTOSELECTED_NODES);
  }

  #drawNodeHighlight() {
    if (!this.#graphNodeById) {
      return;
    }

    if (!this.#highlightedComponent) {
      this.#highlightedNode.clear();
      return;
    }

    const graphNode = this.#graphNodeById.get(
      this.#highlightedComponent.descriptor.id
    );
    if (!graphNode || !(graphNode instanceof GraphNode)) {
      this.#highlightedNode.clear();
      return;
    }

    const renderNodeHighlight = () => {
      if (graphNode.width === 0 || graphNode.height === 0) {
        return;
      }

      const { width, height } = graphNode.dimensions;
      this.#highlightedNode.clear();
      this.#highlightedNode.setFillStyle({
        color: this.#highlightedNodeColor,
        alpha: 0.25,
      });
      this.#highlightedNode.beginPath();
      this.#highlightedNode.roundRect(
        graphNode.x - this.#highlightPadding,
        graphNode.y - this.#highlightPadding,
        width + this.#highlightPadding * 2,
        height + this.#highlightPadding * 2,
        graphNode.borderRadius + this.#highlightPadding
      );
      this.#highlightedNode.closePath();
      this.#highlightedNode.fill();

      this.addChildAt(this.#highlightedNode, 0);
    };

    // It's possible this will be called before the graph node has rendered, so
    // if that happens wait for the draw event to fire then try again.
    if (graphNode.width === 0 && graphNode.height === 0) {
      graphNode.once(GRAPH_OPERATIONS.GRAPH_NODE_DRAWN, renderNodeHighlight);
    } else {
      renderNodeHighlight();
    }
  }

  #drawSubGraphOutline() {
    this.#subGraphOutline.clear();

    if (!this.subGraphId) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const child of this.children) {
      if (!(child instanceof GraphNode || child instanceof GraphComment)) {
        continue;
      }

      let width = child.width;
      let height = child.height;
      if (child instanceof GraphNode) {
        const dims = child.dimensions;
        width = dims.width;
        height = dims.height;
      }

      minX = Math.min(minX, child.position.x);
      minY = Math.min(minY, child.position.y);

      maxX = Math.max(maxX, child.position.x + width);
      maxY = Math.max(maxY, child.position.y + height);
    }

    minX -= this.#subGraphOutlinePadding;
    minY -= this.#subGraphOutlinePadding;
    maxX += this.#subGraphOutlinePadding;
    maxY += this.#subGraphOutlinePadding;

    minX = Math.round(minX);
    minY = Math.round(minY);
    maxX = Math.round(maxX);
    maxY = Math.round(maxY);

    this.#subGraphOutline.setStrokeStyle({
      color: this.#subGraphBorderColor,
      width: 1,
      alpha: 1,
    });
    this.#subGraphOutline.beginPath();
    this.#subGraphOutline.roundRect(
      minX + 0.5,
      minY + 0.5,
      maxX - minX + 0.5,
      maxY - minY + 0.5,
      8 + this.#subGraphOutlinePadding
    );
    this.#subGraphOutline.closePath();
    this.#subGraphOutline.fill({ color: 0xffffff, alpha: 0.2 });
    this.#subGraphOutline.stroke();

    // Label Placeholder
    if (this.#subGraphTitleLabel) {
      const x = minX + 24;
      const y = minY + 8;
      this.#subGraphOutline.beginPath();
      this.#subGraphOutline.roundRect(
        minX + 24,
        minY - 8,
        this.#subGraphTitleLabel.width + 20,
        this.#subGraphTitleLabel.height + 7,
        50
      );
      this.#subGraphOutline.closePath();
      this.#subGraphOutline.fill({ color: this.#subGraphLabelColor });

      this.#subGraphTitleLabel.x = x + 9;
      this.#subGraphTitleLabel.y = y - 13;
      this.addChildAt(this.#subGraphTitleLabel, 0);
    }

    this.addChildAt(this.#subGraphOutline, 0);
  }

  #computeSideEdges(): SideEdge[] {
    if (!this.#ports) {
      return [];
    }

    return [...this.#ports.entries()]
      .flatMap(([nodeId, ports]) => {
        return ports.side.ports.map((port) => {
          if (!port.configured) return null;
          if (typeof port.value !== "string") return null;
          const graphId = port.value;
          return {
            nodeId,
            portName: port.name,
            graphId,
          };
        });
      })
      .filter(Boolean) as SideEdge[];
  }

  #drawNodes() {
    if (!this.#nodes || !this.#ports) {
      return;
    }

    const isInitialDraw = this.#isInitialDraw;
    this.#isInitialDraw = false;

    /**
     * We only position the graph on the initial draw, and we need the graph to
     * be drawn before we can query its dimensions. So we check the layout map,
     * which should only be empty on the first render. We then track each node
     * render, and when all have drawn we notify the graph itself that it can
     * centralize the graph.
     */
    let nodesLeftToDraw = this.#nodes.length;
    const onDraw = function (this: {
      graphNode: GraphNode;
      layout: LayoutInfo | null;
      isInitialDraw: boolean;
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
        this.graphNode.expansionState = this.layout.expansionState;

        this.graphNode.parent.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_SELECTED,
          this.graphNode.label
        );
        this.graphNode.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_MOVED,
          this.layout.x,
          this.layout.y,
          true
        );
      }

      if (nodesLeftToDraw === 0) {
        this.graphNode.parent.emit(GRAPH_OPERATIONS.GRAPH_DRAW);

        if (this.isInitialDraw) {
          this.graphNode.parent.emit(GRAPH_OPERATIONS.GRAPH_INITIAL_DRAW);
        }
      }
    };

    for (const node of this.#nodes) {
      const { id, type } = node.descriptor;
      const { title: typeTitle = type, icon } =
        this.#typeMetadata?.get(type) || {};
      let graphNode = this.#graphNodeById.get(id);
      if (!graphNode || !(graphNode instanceof GraphNode)) {
        graphNode = new GraphNode(id, type, node.title(), typeTitle);
        graphNode.showNodeTypeDescriptions = this.showNodeTypeDescriptions;
        graphNode.showNodePreviewValues = this.showNodePreviewValues;

        graphNode.titleTextColor = nodeTextColor;
        graphNode.borderColor = nodeBorderColor;

        this.#graphNodeById.set(id, graphNode);
      }

      if (graphNode.title !== node.title()) {
        graphNode.title = node.title();
      }

      if (icon && GraphAssets.instance().has(icon)) {
        graphNode.icon = icon;
      } else if (GraphAssets.instance().has(type)) {
        graphNode.icon = type;
      }

      if (node.descriptor.metadata?.visual) {
        const { x, y, collapsed } = node.descriptor.metadata
          .visual as VisualMetadata;

        // We may receive visual values for the node, but we may also have
        // marked the node as having just been added to the editor. So we go
        // looking for the layout value in order to honour the `justAdded` flag
        // that may have been set.
        const existingLayout = this.getNodeLayoutPosition(id);
        let justAdded = false;
        if (existingLayout) {
          justAdded = existingLayout.justAdded || false;
        }
        const expansionState = expansionStateFromMetadata(
          collapsed,
          this.collapseNodesByDefault
        );
        const pos = this.toGlobal({ x: x ?? 0, y: y ?? 0 });
        this.setNodeLayoutPosition(id, "node", pos, expansionState, justAdded);

        graphNode.expansionState = expansionState;
      }

      const portInfo = this.#ports.get(id);
      if (!portInfo) {
        console.warn(`Unable to locate port info for ${id}`);
        continue;
      }

      graphNode.label = id;
      graphNode.readOnly = this.readOnly;
      graphNode.inPorts = portInfo.inputs.ports;
      graphNode.outPorts = portInfo.outputs.ports;
      graphNode.sidePorts = portInfo.side.ports;
      graphNode.fixedInputs = portInfo.inputs.fixed;
      graphNode.fixedOutputs = portInfo.outputs.fixed;
      const info = this.#nodeInfo;
      if (info) {
        graphNode.activity = info.getActivity(id) ?? null;
        graphNode.showNodeRunnerButton = info.canRunNode(id);
      } else {
        graphNode.activity = null;
        graphNode.showNodeRunnerButton = false;
      }

      graphNode.forceUpdateDimensions();
      graphNode.removeAllListeners();
      graphNode.addPointerEventListeners();
      graphNode.on(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.#onChildMoved, {
        graph: this,
        id,
      });

      // PIXI doesn't bubble events automatically, so we re-issue the event for
      // requesting the menu to the graph renderer.
      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_NODE_MENU_REQUESTED,
        (graphNode: GraphNode, location: PIXI.ObservablePoint) => {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_NODE_MENU_REQUESTED,
            graphNode,
            location
          );
        }
      );

      graphNode.once(GRAPH_OPERATIONS.GRAPH_NODE_DRAWN, onDraw, {
        graphNode,
        layout: this.#layout.get(id) || null,
        isInitialDraw,
      });

      graphNode.on(GRAPH_OPERATIONS.GRAPH_NODE_EXPAND_COLLAPSE, () => {
        this.#redrawAllEdges();
        this.#drawNodeHighlight();
        this.#drawSubGraphOutline();

        const layout = this.#layout.get(graphNode.label);
        if (!layout) {
          return;
        }

        if (layout.expansionState === graphNode.expansionState) {
          return;
        }

        layout.expansionState = graphNode.expansionState;
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_EXPAND_COLLAPSE);
      });

      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSEENTER,
        (...args: unknown[]) =>
          this.emit(GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSEENTER, ...args)
      );

      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSELEAVE,
        (...args: unknown[]) =>
          this.emit(GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSELEAVE, ...args)
      );

      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
        (...args: unknown[]) => {
          this.emit(GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT, ...args);
        }
      );

      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED,
        (...args: unknown[]) => {
          this.emit(GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED, ...args);
        }
      );

      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_SHOW_TOOLTIP,
        (...args: unknown[]) => {
          this.emit(GRAPH_OPERATIONS.GRAPH_SHOW_TOOLTIP, ...args);
        }
      );

      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_HIDE_TOOLTIP,
        (...args: unknown[]) => {
          this.emit(GRAPH_OPERATIONS.GRAPH_HIDE_TOOLTIP, ...args);
        }
      );

      graphNode.on(
        GRAPH_OPERATIONS.GRAPH_NODE_RUN_REQUESTED,
        (...args: unknown[]) => {
          this.emit(GRAPH_OPERATIONS.GRAPH_NODE_RUN_REQUESTED, ...args);
        }
      );

      graphNode.on(GRAPH_OPERATIONS.GRAPH_NODE_EDIT, (...args: unknown[]) => {
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_EDIT, ...args);
      });

      this.addChild(graphNode);
    }

    this.#removeStaleNodes();
  }

  // TODO: Merge this with below.
  #createTemporaryEdge(edge: EdgeData): GraphEdge | null {
    const fromNode = this.#graphNodeById.get(edge.from.descriptor.id);
    const toNode = this.#graphNodeById.get(edge.to.descriptor.id);

    if (!(fromNode && toNode)) {
      return null;
    }

    if (!(fromNode instanceof GraphNode && toNode instanceof GraphNode)) {
      return null;
    }

    const edgeGraphic = new GraphEdge(fromNode, toNode, true);
    edgeGraphic.edge = edge;
    this.#edgeGraphics.set("__Temporary_Edge", edgeGraphic);
    this.#edgeContainer.addChild(edgeGraphic);

    return edgeGraphic;
  }

  #redrawAllEdges() {
    if (!this.#edges) {
      return;
    }

    for (const edge of this.#edges) {
      const edgeGraphic = this.#edgeGraphics.get(inspectableEdgeToString(edge));
      if (!edgeGraphic) {
        continue;
      }

      edgeGraphic.forceRedraw();
    }
  }

  #drawComments() {
    if (!this.#comments) {
      return;
    }

    for (const node of this.#comments) {
      const { id, text } = node;
      let graphComment = this.#graphNodeById.get(id);
      if (!graphComment) {
        graphComment = new GraphComment();

        this.#graphNodeById.set(id, graphComment);
      }

      if (!(graphComment instanceof GraphComment)) {
        continue;
      }

      if (node.metadata?.visual) {
        const { x, y, collapsed } = node.metadata.visual as VisualMetadata;

        // We may receive visual values for the node, but we may also have
        // marked the node as having just been added to the editor. So we go
        // looking for the layout value in order to honour the `justAdded` flag
        // that may have been set.
        const existingLayout = this.getNodeLayoutPosition(id);
        let justAdded = false;
        if (existingLayout) {
          justAdded = existingLayout.justAdded || false;
        }
        const expansionState = expansionStateFromMetadata(
          collapsed,
          this.collapseNodesByDefault
        );

        const pos = this.toGlobal({ x, y });
        this.setNodeLayoutPosition(
          id,
          "comment",
          pos,
          expansionState,
          justAdded
        );

        graphComment.expansionState = expansionState;
      }

      graphComment.label = id;
      graphComment.text = text;
      graphComment.readOnly = this.readOnly;
      graphComment.removeAllListeners();
      graphComment.addPointerEventListeners();
      graphComment.on(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.#onChildMoved, {
        graph: this,
        id,
      });

      graphComment.on(
        GRAPH_OPERATIONS.GRAPH_BOARD_LINK_CLICKED,
        (board: string) => {
          // Re-emit for the renderer to pick up.
          this.emit(GRAPH_OPERATIONS.GRAPH_BOARD_LINK_CLICKED, board);
        }
      );

      graphComment.on(
        GRAPH_OPERATIONS.GRAPH_COMMENT_EDIT_REQUESTED,
        (...args: unknown[]) => {
          this.emit(GRAPH_OPERATIONS.GRAPH_COMMENT_EDIT_REQUESTED, ...args);
        }
      );

      graphComment.once(GRAPH_OPERATIONS.GRAPH_COMMENT_DRAWN, () => {
        const layout = this.getNodeLayoutPosition(id);

        if (!layout || !layout.justAdded) {
          return;
        }

        layout.x -= graphComment.width / 2;
        layout.y -= graphComment.height / 2;
        layout.justAdded = false;

        graphComment.position.set(layout.x, layout.y);
        graphComment.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_MOVED,
          layout.x,
          layout.y,
          true
        );
      });

      this.addChild(graphComment);
    }

    this.#removeStaleNodes();
  }

  #drawEdges() {
    if (!this.#edges) {
      return;
    }

    const sideEdges = this.#computeSideEdges();
    if (sideEdges.length) {
      // TODO.
      // console.log("✨ sideEdges", sideEdges);
    }

    for (const edge of this.#edges) {
      let edgeGraphic = this.#edgeGraphics.get(inspectableEdgeToString(edge));
      if (!edgeGraphic) {
        const fromNode = this.#graphNodeById.get(edge.from.descriptor.id);
        const toNode = this.#graphNodeById.get(edge.to.descriptor.id);

        // Only create the edge when the nodes are present.
        if (!(fromNode && toNode)) {
          continue;
        }

        if (!(fromNode instanceof GraphNode && toNode instanceof GraphNode)) {
          return null;
        }

        edgeGraphic = new GraphEdge(fromNode, toNode);
        edgeGraphic.type = edge.type;

        // Propagate edge value clicks to the graph renderer.
        edgeGraphic.on(
          GRAPH_OPERATIONS.GRAPH_EDGE_VALUE_SELECTED,
          (...args: unknown[]) => {
            this.emit(GRAPH_OPERATIONS.GRAPH_EDGE_VALUE_SELECTED, ...args);
          }
        );

        this.#edgeGraphics.set(inspectableEdgeToString(edge), edgeGraphic);
        this.#edgeContainer.addChild(edgeGraphic);
      }

      edgeGraphic.value = this.#edgeValues?.get(edge) ?? null;
      edge.outPort().then((port) => {
        edgeGraphic.schema = port.schema || null;
      });
      edgeGraphic.edge = edge;
      edgeGraphic.readOnly = this.readOnly;
      if (this.highlightInvalidWires) {
        this.#scheduleValidation(edge, edgeGraphic);
      } else {
        edgeGraphic.invalid = false;
      }
    }

    this.#removeStaleEdges();

    this.addChildAt(this.#edgeContainer, 0);
  }

  /**
   * Validation is asynchronous because it relies on calling `describe` to get
   * node descriptions, and `describe` functions are asynchronous.
   */
  async #scheduleValidation(edge: InspectableEdge, edgeGraphic: GraphEdge) {
    // A unique symbol to act as a token representing this particular request.
    const thisRequest = Symbol();
    this.#latestPendingValidateRequest.set(edgeGraphic, thisRequest);
    const result = await edge.validate();
    if (this.#latestPendingValidateRequest.get(edgeGraphic) !== thisRequest) {
      // Another validate request started before this one finished. Cancel this
      // one, otherwise we might clobber a newer result with an older one, since
      // the timing of validation is not guaranteed.
      return;
    }
    this.#latestPendingValidateRequest.delete(edgeGraphic);
    edgeGraphic.invalid = result.status === "invalid";
  }

  #removeStaleEdges() {
    if (!this.#edges) {
      return;
    }

    // If there's a mismatch of sizes it likely means an edge has been removed
    // so find that edge and dispose of it.
    if (this.#edgeGraphics.size === this.#edges.length) {
      return;
    }

    for (const [edgeDescription, edgeGraphic] of this.#edgeGraphics) {
      if (
        this.#edges.find(
          (edge) => inspectableEdgeToString(edge) === edgeDescription
        )
      ) {
        continue;
      }

      edgeGraphic.removeFromParent();
      edgeGraphic.destroy();
      this.#edgeGraphics.delete(edgeDescription);
    }
  }

  #removeStaleNodes() {
    const count = (this.#comments?.length || 0) + (this.#nodes?.length || 0);
    if (count < this.#graphNodeById.size) {
      for (const [id, node] of this.#graphNodeById) {
        const commentNode = this.#comments?.find((node) => node.id === id);
        const graphNode = this.#nodes?.find(
          (node) => node.descriptor.id === id
        );
        if (commentNode || graphNode) {
          continue;
        }

        node.removeFromParent();
        node.destroy();
        this.#graphNodeById.delete(id);
        this.#layout.delete(id);
      }
    }
  }
}
