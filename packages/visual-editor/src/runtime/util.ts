/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Edge,
  EditSpec,
  GraphDescriptor,
  GraphIdentifier,
  InspectableEdge,
  InspectableGraph,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
} from "@google-labs/breadboard";
import {
  EditChangeId,
  GraphSelectionState,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
} from "./types";

const MAIN_BOARD_ID = "Main board";

export function edgeToString(edge: Edge): string {
  return `${edge.from}:${edge.out}->${edge.to}:${edge.in}`;
}

export function inspectableEdgeToString(edge: InspectableEdge): string {
  return edgeToString(edge.raw());
}

export function createNodeId(): NodeIdentifier {
  return globalThis.crypto.randomUUID();
}

export function createGraphId(): GraphIdentifier {
  return globalThis.crypto.randomUUID();
}

export function createEditChangeId(): EditChangeId {
  return globalThis.crypto.randomUUID();
}

export function createWorkspaceSelectionChangeId(): WorkspaceSelectionChangeId {
  return globalThis.crypto.randomUUID();
}

export function createEmptyWorkspaceSelectionState(): WorkspaceSelectionState {
  return new Map();
}

export function createEmptyGraphSelectionState(): GraphSelectionState {
  return {
    nodes: new Set(),
    comments: new Set(),
    edges: new Set(),
  };
}

export function generateBoardFrom(
  selectionState: WorkspaceSelectionState,
  graph: InspectableGraph
): GraphDescriptor {
  const filteredGraph = structuredClone(graph.raw());

  const filterGraph = (
    graph: GraphDescriptor,
    selectionState: GraphSelectionState
  ) => {
    graph.nodes = graph.nodes.filter((node) =>
      selectionState.nodes.has(node.id)
    );
    graph.edges = graph.edges.filter(
      (edge) =>
        selectionState.edges.has(edgeToString(edge)) &&
        selectionState.nodes.has(edge.from) &&
        selectionState.nodes.has(edge.to)
    );
  };

  const subGraphs = filteredGraph.graphs ?? {};
  for (const subGraph of Object.keys(subGraphs)) {
    if (selectionState.has(subGraph)) {
      continue;
    }

    delete subGraphs[subGraph];
  }

  if (!selectionState.has(MAIN_BOARD_ID)) {
    filterGraph(filteredGraph, createEmptyGraphSelectionState());
  }

  for (const [id, graphSelectionState] of selectionState) {
    if (id === MAIN_BOARD_ID) {
      filterGraph(filteredGraph, graphSelectionState);
    } else {
      if (!filteredGraph.graphs) {
        continue;
      }

      filterGraph(filteredGraph.graphs[id], graphSelectionState);
    }
  }

  return filteredGraph;
}

export function generateDeleteEditSpecFrom(
  selectionState: WorkspaceSelectionState,
  graph: InspectableGraph
): EditSpec[] {
  const createDeleteEditSpecsForGraph = (
    state: GraphSelectionState,
    graphId: GraphIdentifier,
    graph: InspectableGraph
  ) => {
    if (graphId === MAIN_BOARD_ID) {
      graphId = "";
    }

    const edits: EditSpec[] = [];
    // Edges. Handle these before any nodes they relate to.
    for (const edgeId of state.edges) {
      const edge = graph
        .edges()
        .find((edge) => inspectableEdgeToString(edge) === edgeId);
      if (!edge) {
        continue;
      }

      edits.push({ type: "removeedge", graphId, edge: edge.raw() });
    }

    // Nodes.
    for (const nodeId of state.nodes) {
      edits.push({ type: "removenode", id: nodeId, graphId });
    }

    // Comments.
    if (state.comments.size > 0) {
      const metadata = graph.metadata();
      if (metadata) {
        metadata.comments = (metadata.comments ?? []).filter(
          (comment) => !state.comments.has(comment.id)
        );

        edits.push({
          type: "changegraphmetadata",
          metadata,
          graphId,
        });
      }
    }

    return edits;
  };

  const edits: EditSpec[] = [];
  for (const [id, graphSelectionState] of selectionState) {
    let graphToEdit = graph;
    if (id !== MAIN_BOARD_ID) {
      const subGraphs = graph.graphs();
      if (!subGraphs) {
        continue;
      }

      graphToEdit = subGraphs[id];
      if (!graphToEdit) {
        continue;
      }
    }

    edits.push(
      ...createDeleteEditSpecsForGraph(graphSelectionState, id, graphToEdit)
    );
  }

  return edits;
}

function adjustNodePosition(
  node: NodeDescriptor,
  leftMostNode: { x: number; y: number },
  pointerLocation: { x: number; y: number }
) {
  node.metadata ??= {};
  node.metadata.title ??= node.type;
  node.metadata.visual ??= { x: 0, y: 0, collapsed: "collapsed" };
  const location = node.metadata.visual as {
    x: number;
    y: number;
    collapsed: string;
  };

  location.x = location.x - leftMostNode.x + pointerLocation.x;
  location.y = location.y - leftMostNode.y + pointerLocation.y;
}

function getLeftMostLocation(
  graph: GraphDescriptor,
  leftMostNode = {
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
  }
): { x: number; y: number } {
  for (const node of graph.nodes) {
    if (node.metadata?.visual) {
      const location = node.metadata.visual as {
        x: number;
        y: number;
        collapsed: string;
      };
      if (location.x < leftMostNode.x) {
        leftMostNode.x = location.x;
        leftMostNode.y = location.y;
      }
    }
  }

  return leftMostNode;
}

function isInvalidPosition(position: { x: number; y: number }): boolean {
  return (
    position.x === Number.POSITIVE_INFINITY ||
    position.y === Number.POSITIVE_INFINITY
  );
}

export function generateAddEditSpecFromURL(
  boardUrl: string,
  targetGraph: InspectableGraph,
  pointerLocation: { x: number; y: number } = { x: 0, y: 0 }
) {
  const slug = new URL(boardUrl).pathname.split("/").at(-1);
  const title = `Board (${slug})`;
  const node: NodeDescriptor = {
    id: createNodeId(),
    type: boardUrl,
    metadata: {
      title,
      visual: {
        ...pointerLocation,
      },
    },
  };

  const edits: EditSpec[] = [
    {
      type: "addnode",
      node,
      graphId: targetGraph.graphId(),
    },
  ];
  return edits;
}

export function getDefaultConfiguration(
  type: string
): NodeConfiguration | undefined {
  if (type !== "input" && type !== "output") {
    return undefined;
  }

  return {
    schema: {
      properties: {
        context: {
          type: "array",
          title: "Context",
          items: {
            type: "object",
            examples: [],
            behavior: ["llm-content"],
          },
          default:
            type === "input"
              ? '[{"role":"user","parts":[{"text":""}]}]'
              : "null",
        },
      },
      type: "object",
      required: [],
    },
  };
}

export function generateSelectionFrom(
  spec: EditSpec[]
): WorkspaceSelectionState {
  const selections = createEmptyWorkspaceSelectionState();
  for (const item of spec) {
    switch (item.type) {
      case "addnode": {
        const graphId = item.graphId === "" ? MAIN_BOARD_ID : item.graphId;
        let graphState = selections.get(graphId);
        if (!graphState) {
          graphState = createEmptyGraphSelectionState();
          selections.set(graphId, graphState);
        }

        graphState.nodes.add(item.node.id);
        break;
      }

      case "addedge": {
        const graphId = item.graphId === "" ? MAIN_BOARD_ID : item.graphId;
        let graphState = selections.get(graphId);
        if (!graphState) {
          graphState = createEmptyGraphSelectionState();
          selections.set(graphId, graphState);
        }

        graphState.edges.add(edgeToString(item.edge));
        break;
      }

      case "addgraph": {
        const graphId = item.id;
        let graphState = selections.get(graphId);
        if (!graphState) {
          graphState = createEmptyGraphSelectionState();
          selections.set(graphId, graphState);
        }

        for (const node of item.graph.nodes) {
          graphState.nodes.add(node.id);
        }

        for (const edge of item.graph.edges) {
          graphState.nodes.add(edgeToString(edge));
        }
        break;
      }

      default: {
        break;
      }
    }
  }

  return selections;
}

export function generateAddEditSpecFromComponentType(
  type: string,
  targetGraph: InspectableGraph,
  pointerLocation: { x: number; y: number } = { x: 0, y: 0 }
) {
  const title = `${type[0].toLocaleUpperCase()}${type.slice(1)}`;
  const node: NodeDescriptor = {
    id: createNodeId(),
    type: type,
    metadata: {
      title,
      visual: {
        ...pointerLocation,
      },
    },
  };

  const configuration = getDefaultConfiguration(type);
  if (configuration) {
    node.configuration = configuration;
  }

  const edits: EditSpec[] = [
    {
      type: "addnode",
      node,
      graphId: targetGraph.graphId(),
    },
  ];
  return edits;
}

export function generateAddEditSpecFromDescriptor(
  sourceGraph: GraphDescriptor,
  targetGraph: InspectableGraph,
  pointerLocation: { x: number; y: number } = { x: 0, y: 0 }
) {
  const edits: EditSpec[] = [];

  // Find the left-most node in the target graph and then use that as the base
  // for all node locations.
  let leftMostNode = getLeftMostLocation(sourceGraph);
  const subGraphs = sourceGraph.graphs || {};
  for (const subGraph of Object.values(subGraphs)) {
    leftMostNode = getLeftMostLocation(subGraph, leftMostNode);
  }

  // If all else fails, reset to zero.
  if (isInvalidPosition(leftMostNode)) {
    if (
      leftMostNode.x === Number.POSITIVE_INFINITY ||
      leftMostNode.y === Number.POSITIVE_INFINITY
    ) {
      leftMostNode.x = leftMostNode.y = 0;
    }
  }

  const remappedNodes = new Map<NodeIdentifier, NodeIdentifier>();
  for (const node of sourceGraph.nodes) {
    if (targetGraph.nodeById(node.id)) {
      const newId = createNodeId();
      // Track any renamed nodes so we can update edges.
      remappedNodes.set(node.id, newId);
      node.id = newId;
    }

    adjustNodePosition(node, leftMostNode, pointerLocation);

    edits.push({ type: "addnode", node, graphId: "" });
  }

  for (const edge of sourceGraph.edges) {
    const remappedFrom = remappedNodes.get(edge.from);
    const remappedTo = remappedNodes.get(edge.to);
    if (remappedFrom) {
      edge.from = remappedFrom;
    }
    if (remappedTo) {
      edge.to = remappedTo;
    }

    edits.push({ type: "addedge", edge, graphId: "" });
  }

  for (const [id, subGraph] of Object.entries(sourceGraph.graphs ?? {})) {
    const graphs = targetGraph.graphs();
    let graphId = id;
    if (graphs && graphs[id]) {
      graphId = createGraphId();
    }

    for (const node of subGraph.nodes) {
      adjustNodePosition(node, leftMostNode, pointerLocation);
    }

    if (!graphs || !graphs[graphId]) {
      edits.push({ type: "addgraph", id: graphId, graph: subGraph });
    }
  }

  return edits;
}

/**
 * Also expose it on the outside.
 */
export const Util = {
  createEditChangeId,
  createEmptyGraphSelectionState,
  createEmptyWorkspaceSelectionState,
  createGraphId,
  createNodeId,
  createWorkspaceSelectionChangeId,
  edgeToString,
  generateAddEditSpecFromComponentType,
  generateAddEditSpecFromDescriptor,
  generateAddEditSpecFromURL,
  generateBoardFrom,
  generateDeleteEditSpecFrom,
  generateSelectionFrom,
  getDefaultConfiguration,
  inspectableEdgeToString,
};
