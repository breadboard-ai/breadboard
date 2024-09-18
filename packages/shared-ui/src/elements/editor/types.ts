/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GRAPH_OPERATIONS {
  GRAPH_BOARD_LINK_CLICKED = "graphboardlinkclicked",
  GRAPH_AUTOSELECTED_NODES = "graphautoselectednodes",
  GRAPH_NODE_DRAWN = "graphnodedrawn",
  GRAPH_COMMENT_DRAWN = "graphcommentdrawn",
  GRAPH_COMMENT_EDIT_REQUESTED = "graphcommenteditrequested",
  GRAPH_NODE_MOVED = "graphnodemoved",
  GRAPH_NODES_MOVED = "graphnodesmoved",
  GRAPH_INITIAL_DRAW = "graphinitialdraw",
  GRAPH_DRAW = "graphdraw",
  GRAPH_NODE_SELECTED = "graphnodeselected",
  GRAPH_NODE_DESELECTED = "graphnodedeselected",
  GRAPH_NODE_DESELECTED_ALL = "graphnodedeselectedall",
  GRAPH_NODE_ACTIVITY_SELECTED = "graphnodeactivityselected",
  GRAPH_EDGE_VALUE_SELECTED = "graphedgevalueselected",
  GRAPH_EDGE_ATTACH = "graphedgeattach",
  GRAPH_EDGE_DETACH = "graphedgedetach",
  GRAPH_EDGE_CHANGE = "graphedgechange",
  GRAPH_EDGE_SELECT_DISAMBIGUATION_REQUESTED = "graphedgeselectdisambiguationrequested",
  GRAPH_EDGE_ADD_DISAMBIGUATION_REQUESTED = "graphedgeadddisambiguationrequested",
  GRAPH_EDGE_ADD_AD_HOC_DISAMBIGUATION_REQUESTED = "graphedgeaddadhocdisambiguationrequested",
  GRAPH_NODE_EXPAND_COLLAPSE = "graphnodeexpandcollapse",
  GRAPH_NODE_MENU_CLICKED = "graphnodemenuclicked",
  GRAPH_NODE_MENU_REQUESTED = "graphnodemenurequested",
  GRAPH_NODE_PORT_MOUSEENTER = "graphnodeportmouseenter",
  GRAPH_NODE_PORT_MOUSELEAVE = "graphnodeportmouseleave",
  GRAPH_NODE_PORT_VALUE_EDIT = "graphnodeportvalueedit",
  GRAPH_SHOW_TOOLTIP = "graphshowtooltip",
  GRAPH_HIDE_TOOLTIP = "graphhidetooltip",
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
