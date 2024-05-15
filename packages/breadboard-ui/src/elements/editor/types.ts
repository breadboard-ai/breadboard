/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GRAPH_OPERATIONS {
  GRAPH_NODE_DRAWN = "graphnodedrawn",
  GRAPH_NODE_MOVED = "graphnodemoved",
  GRAPH_INITIAL_DRAW = "graphinitialdraw",
  GRAPH_DRAW = "graphdraw",
  GRAPH_NODE_DETAILS_REQUESTED = "graphnodedetailsrequested",
  GRAPH_EDGE_ATTACH = "graphedgeattach",
  GRAPH_EDGE_DETACH = "graphedgedetach",
  GRAPH_EDGE_CHANGE = "graphedgechange",
  GRAPH_EDGE_SELECT_DISAMBIGUATION_REQUESTED = "graphedgeselectdisambiguationrequested",
  GRAPH_EDGE_ADD_DISAMBIGUATION_REQUESTED = "graphedgeadddisambiguationrequested",
  GRAPH_EDGE_ADD_AD_HOC_DISAMBIGUATION_REQUESTED = "graphedgeaddadhocdisambiguationrequested",
  GRAPH_NODE_EXPAND_COLLAPSE = "graphnodeexpandcollapse",
  GRAPH_NODE_MENU_CLICKED = "graphnodemenuclicked",
  GRAPH_NODE_MENU_REQUESTED = "graphnodemenurequested",
}

export enum GraphNodePortType {
  IN = "in",
  OUT = "out",
}
