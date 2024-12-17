/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphMetadata, NodeIdentifier } from "@breadboard-ai/types";
import {
  InspectableEdge,
  InspectableModules,
  InspectableNode,
  InspectableNodePorts,
  NodeHandlerMetadata,
  PortIdentifier,
} from "@google-labs/breadboard";
import { GraphSelectionState } from "../../types/types";

export enum GRAPH_OPERATIONS {
  GRAPH_BOARD_LINK_CLICKED = "graphboardlinkclicked",
  GRAPH_AUTOSELECTED_NODES = "graphautoselectednodes",
  GRAPH_NODE_DRAWN = "graphnodedrawn",
  GRAPH_COMMENT_DRAWN = "graphcommentdrawn",
  GRAPH_COMMENT_EDIT_REQUESTED = "graphcommenteditrequested",
  GRAPH_COMMENT_TOGGLE_SELECTED = "graphcommenttoggleselected",
  GRAPH_NODE_MOVED = "graphnodemoved",
  GRAPH_INITIAL_DRAW = "graphinitialdraw",
  GRAPH_DRAW = "graphdraw",
  GRAPH_NODE_EDIT = "graphnodeedit",
  GRAPH_NODE_TOGGLE_SELECTED = "graphnodetoggleselected",
  GRAPH_SELECTION_MOVE = "graphselectionmove",
  GRAPH_SELECTION_MOVE_SETTLED = "graphselectionmovesettled",
  GRAPH_NODE_ACTIVITY_SELECTED = "graphnodeactivityselected",
  GRAPH_EDGE_VALUE_SELECTED = "graphedgevalueselected",
  GRAPH_EDGE_ATTACH = "graphedgeattach",
  GRAPH_EDGE_DETACH = "graphedgedetach",
  GRAPH_EDGE_CHANGE = "graphedgechange",
  GRAPH_EDGE_SELECT_DISAMBIGUATION_REQUESTED = "graphedgeselectdisambiguationrequested",
  GRAPH_EDGE_ADD_DISAMBIGUATION_REQUESTED = "graphedgeadddisambiguationrequested",
  GRAPH_EDGE_ADD_AD_HOC_DISAMBIGUATION_REQUESTED = "graphedgeaddadhocdisambiguationrequested",
  GRAPH_EDGE_TOGGLE_SELECTED = "graphedgetoggleselected",
  GRAPH_NODE_EXPAND_COLLAPSE = "graphnodeexpandcollapse",
  GRAPH_NODE_MENU_CLICKED = "graphnodemenuclicked",
  GRAPH_NODE_MENU_REQUESTED = "graphnodemenurequested",
  GRAPH_NODE_PORT_MOUSEENTER = "graphnodeportmouseenter",
  GRAPH_NODE_PORT_MOUSELEAVE = "graphnodeportmouseleave",
  GRAPH_NODE_PORT_VALUE_EDIT = "graphnodeportvalueedit",
  GRAPH_NODE_RUN_REQUESTED = "graphnoderunrequested",
  GRAPH_SHOW_TOOLTIP = "graphshowtooltip",
  GRAPH_HIDE_TOOLTIP = "graphhidetooltip",
  GRAPH_TOGGLE_MINIMIZED = "graphtoggleminimized",
  MODULE_SELECTED = "moduleselected",
  SUBGRAPH_SELECTED = "subgraphselected",
  SUBGRAPH_CONNECTION_START = "subgraphconnectionstart",
  GRAPH_REFERENCE_TOGGLE_SELECTED = "graphreferenceselected",
  GRAPH_REFERENCE_GOTO = "graphreferencegoto",
  GRAPH_REFERENCE_LOAD = "graphreferenceload",
  WARN_USER = "warnuser",
}

export enum GraphNodePortType {
  IN = "in",
  OUT = "out",
  INERT = "inert",
}

export type ComponentExpansionState = "collapsed" | "expanded" | "advanced";

export type LayoutInfo = {
  x: number;
  y: number;
  type: "comment" | "node";
  expansionState: ComponentExpansionState;
  justAdded?: boolean;
};

export type VisualMetadata = {
  x: number;
  y: number;
  collapsed: ComponentExpansionState | boolean;
};

export interface GraphOpts {
  url: string;
  title: string;
  subGraphId: string | null;
  showNodePreviewValues: boolean;
  showGraphOutline: boolean;
  collapseNodesByDefault: boolean;
  ports: Map<string, InspectableNodePorts> | null;
  typeMetadata: Map<string, NodeHandlerMetadata> | null;
  references: GraphReferences | null;
  edges: InspectableEdge[];
  nodes: InspectableNode[];
  modules: InspectableModules;
  metadata: GraphMetadata;
  minimized: boolean;
  selectionState: GraphSelectionState | null;
}

export type SideEdge = {
  nodeId: NodeIdentifier;
  portName: string;
  graphId: string;
};

export type GraphReferences = Map<NodeIdentifier, GraphNodeReferences>;

export type GraphNodeReferences = Map<PortIdentifier, GraphNodeReferenceOpts>;

export type GraphNodeReferenceOpts = Array<{
  title: string;
  color: number;
  reference: string;
}>;

export type MoveToSelection = "immediate" | "animated" | false;
