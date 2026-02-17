/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Graph utility functions for edit operations.
 * These were previously in runtime/util.ts but have been relocated
 * to be standalone utilities.
 */

import {
  CommentNode,
  Edge,
  EditSpec,
  GraphDescriptor,
  GraphIdentifier,
  InspectableEdge,
  InspectableGraph,
  NodeConfiguration,
  NodeDescriptor,
  NodeIdentifier,
  Schema,
} from "@breadboard-ai/types";
import { isStoredData } from "@breadboard-ai/utils";
import type { Selection } from "../sca/controller/subcontrollers/editor/selection/selection-controller.js";
import {
  EditChangeId,
  GraphSelectionState,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionState,
} from "./graph-types.js";
import { GraphTheme } from "@breadboard-ai/types";
import {
  generatePaletteFromColor,
  generatePaletteFromImage,
} from "../theme/index.js";
import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import { loadImage } from "../ui/utils/image.js";
import { isLLMContentArray } from "../data/common.js";

export const MAIN_BOARD_ID = "Main board";

export function isBoardBehavior(schema: Schema): boolean {
  return schema.behavior?.includes("board") ?? false;
}

export function isBoardArrayBehavior(schema: Schema): boolean {
  if (schema.type !== "array") return false;
  if (!schema.items) return false;
  if (Array.isArray(schema.items)) return false;
  if (!schema.items.behavior) return false;
  return schema.items.behavior?.includes("board") ?? false;
}

export function edgeToString(edge: Edge): string {
  const edgeIn = edge.out === "*" ? "*" : edge.in;
  return `${edge.from}:${edge.out}->${edge.to}:${edgeIn}`;
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
  return {
    graphs: new Map(),
  };
}

export function createEmptyGraphSelectionState(): GraphSelectionState {
  return {
    nodes: new Set(),
    assets: new Set(),
    assetEdges: new Set(),
    comments: new Set(),
    edges: new Set(),
    references: new Set(),
  };
}

export function generateBoardFrom(
  selectionState: WorkspaceSelectionState | Selection,
  graph: InspectableGraph
): GraphDescriptor {
  if (!isWorkspaceSelection(selectionState)) {
    selectionState = selectionFromFlat(selectionState);
  }
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
    if (graph.metadata && graph.metadata.comments) {
      graph.metadata.comments = graph.metadata.comments.filter((comment) =>
        selectionState.comments.has(comment.id)
      );
    }

    delete graph.assets;
    delete graph.exports;
    delete graph.metadata?.visual;
  };

  const subGraphs = filteredGraph.graphs ?? {};
  for (const subGraph of Object.keys(subGraphs)) {
    if (selectionState.graphs.has(subGraph)) {
      continue;
    }

    delete subGraphs[subGraph];
  }

  if (!selectionState.graphs.has(MAIN_BOARD_ID)) {
    filterGraph(filteredGraph, createEmptyGraphSelectionState());
  }

  for (const [id, graphSelectionState] of selectionState.graphs) {
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
  selectionState: WorkspaceSelectionState | Selection,
  graph: InspectableGraph
): EditSpec[] {
  if (!isWorkspaceSelection(selectionState)) {
    selectionState = selectionFromFlat(selectionState);
  }
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

    // References.
    const referenceIndexes: number[] = [];
    for (const reference of state.references) {
      const [nodeId, portId, indexStr] = reference.split("|");
      if (!nodeId || !portId || !indexStr) {
        continue;
      }

      const index = Number.parseInt(indexStr);
      if (Number.isNaN(index)) {
        console.warn(`Unexpected index in references: '${indexStr}'`);
        continue;
      }

      referenceIndexes.push(index);
    }

    for (const reference of state.references) {
      const [nodeId, portId, indexStr] = reference.split("|");
      if (!nodeId || !portId || !indexStr) {
        continue;
      }

      const index = Number.parseInt(indexStr);
      if (Number.isNaN(index)) {
        console.warn(`Unexpected index in references: '${indexStr}'`);
        continue;
      }

      const configuration = graph.nodeById(nodeId)?.configuration();
      if (!configuration) {
        continue;
      }

      const newConfiguration = structuredClone(configuration);
      if (!newConfiguration[portId]) {
        continue;
      }

      if (Array.isArray(newConfiguration[portId])) {
        newConfiguration[portId] = newConfiguration[portId].filter((_, idx) => {
          return !referenceIndexes.includes(idx);
        });
      } else {
        delete newConfiguration[portId];
      }

      edits.push({
        type: "changeconfiguration",
        graphId,
        id: nodeId,
        configuration: newConfiguration,
        reset: true,
      });
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
  for (const [id, graphSelectionState] of selectionState.graphs) {
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
  node: NodeDescriptor | CommentNode,
  leftMostNode: { x: number; y: number },
  pointerLocation: { x: number; y: number },
  graphOffset = 0
) {
  node.metadata ??= {};
  if ("type" in node) {
    node.metadata.title ??= node.type;
  }
  node.metadata.visual ??= { x: 0, y: 0, collapsed: "collapsed" };
  const location = node.metadata.visual as {
    x: number;
    y: number;
    collapsed: string;
  };

  location.x = location.x - leftMostNode.x + pointerLocation.x + graphOffset;
  location.y = location.y - leftMostNode.y + pointerLocation.y + graphOffset;
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

  const comments = graph.metadata?.comments ?? [];
  for (const comment of comments) {
    if (!comment.metadata?.visual) {
      continue;
    }

    const location = comment.metadata.visual as {
      x: number;
      y: number;
      collapsed: string;
    };
    if (location.x < leftMostNode.x) {
      leftMostNode.x = location.x;
      leftMostNode.y = location.y;
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
        let graphState = selections.graphs.get(graphId);
        if (!graphState) {
          graphState = createEmptyGraphSelectionState();
          selections.graphs.set(graphId, graphState);
        }

        graphState.nodes.add(item.node.id);
        break;
      }

      case "addedge": {
        const graphId = item.graphId === "" ? MAIN_BOARD_ID : item.graphId;
        let graphState = selections.graphs.get(graphId);
        if (!graphState) {
          graphState = createEmptyGraphSelectionState();
          selections.graphs.set(graphId, graphState);
        }

        graphState.edges.add(edgeToString(item.edge));
        break;
      }

      case "addgraph": {
        const graphId = item.id;
        let graphState = selections.graphs.get(graphId);
        if (!graphState) {
          graphState = createEmptyGraphSelectionState();
          selections.graphs.set(graphId, graphState);
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
  source: GraphDescriptor,
  graph: InspectableGraph,
  pointerLocation: { x: number; y: number } = { x: 0, y: 0 },
  destGraphIds: GraphIdentifier[]
) {
  const edits: EditSpec[] = [];

  const graphToSpec = (sourceGraph: GraphDescriptor) => {
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

    let graphOffset = 0;
    for (const graphId of destGraphIds) {
      const targetGraph = graphId === "" ? graph : graph.graphs()?.[graphId];
      if (!targetGraph) {
        continue;
      }

      // Nodes.
      const remappedNodes = new Map<NodeIdentifier, NodeIdentifier>();
      for (const sourceNode of sourceGraph.nodes) {
        const node = structuredClone(sourceNode);
        adjustNodePosition(node, leftMostNode, pointerLocation, graphOffset);

        if (targetGraph.nodeById(node.id)) {
          const newId = createNodeId();
          // Track any renamed nodes so we can update edges.
          remappedNodes.set(node.id, newId);
          node.id = newId;
        }

        edits.push({ type: "addnode", node, graphId });
      }

      // Edges.
      for (const sourceEdge of sourceGraph.edges) {
        const edge = structuredClone(sourceEdge);

        const remappedFrom = remappedNodes.get(edge.from);
        const remappedTo = remappedNodes.get(edge.to);
        if (remappedFrom) {
          edge.from = remappedFrom;
        }
        if (remappedTo) {
          edge.to = remappedTo;
        }

        edits.push({ type: "addedge", edge, graphId });
      }

      const existingMetadata = structuredClone(targetGraph.metadata() ?? {});
      let updateGraphMetadata = false;

      // Comments.
      const comments = sourceGraph.metadata?.comments;
      if (comments) {
        existingMetadata.comments ??= [];
        for (const sourceComment of comments) {
          const comment = structuredClone(sourceComment);

          comment.id = createNodeId();
          adjustNodePosition(
            comment,
            leftMostNode,
            pointerLocation,
            graphOffset
          );
          existingMetadata.comments.push(comment);
          updateGraphMetadata = true;
        }
      }

      // Also copy "describer", if present
      const describer = sourceGraph.metadata?.describer;
      if (describer) {
        existingMetadata.describer = describer;
        updateGraphMetadata = true;
      }

      if (updateGraphMetadata) {
        edits.push({
          type: "changegraphmetadata",
          metadata: { ...existingMetadata },
          graphId,
        });
      }

      graphOffset += 10;
    }

    // Subgraphs.
    for (const subGraph of Object.values(sourceGraph.graphs ?? {})) {
      if (subGraph.nodes.length === 0) {
        continue;
      }

      graphToSpec(subGraph);
    }
  };

  graphToSpec(source);

  return edits;
}

export function applyDefaultThemeInformationIfNonePresent(
  graph: GraphDescriptor
) {
  // Already migrated.
  if (
    graph.metadata?.visual?.presentation?.themes &&
    graph.metadata?.visual?.presentation?.theme
  ) {
    return;
  }

  // No legacy theme info available - fit out the default theme.
  if (!graph.metadata?.visual?.presentation?.themeColors) {
    graph.metadata ??= {};
    graph.metadata.visual ??= {};
    graph.metadata.visual.presentation ??= {};
    graph.metadata.visual.presentation.themes ??= {};

    const graphTheme: GraphTheme = {
      themeColors: {
        primaryColor: "#1a1a1a",
        secondaryColor: "#7a7a7a",
        backgroundColor: "#ffffff",
        textColor: "#1a1a1a",
        primaryTextColor: "#ffffff",
      },
      template: "basic",
      isDefaultTheme: true,
      palette: generatePaletteFromColor("#a5a5a5"),
    };

    const themeId = globalThis.crypto.randomUUID();
    graph.metadata.visual.presentation.themes[themeId] = graphTheme;
    graph.metadata.visual.presentation.theme = themeId;
    return;
  }

  const { themeColors, template, templateAdditionalOptions } =
    graph.metadata.visual.presentation;
  const graphTheme: GraphTheme = {
    themeColors,
    templateAdditionalOptions,
    template,
  };

  const splashScreen = graph.assets?.["@@splash"];
  if (
    isLLMContentArray(splashScreen?.data) &&
    isStoredData(splashScreen.data[0]?.parts[0])
  ) {
    graphTheme.splashScreen = splashScreen.data[0].parts[0];
  }

  graph.metadata.visual.presentation.themes ??= {};

  // Set the theme.
  const themeId = globalThis.crypto.randomUUID();
  graph.metadata.visual.presentation.themes[themeId] = graphTheme;
  graph.metadata.visual.presentation.theme = themeId;

  // Remove the legacy values.
  delete graph.metadata.visual.presentation.template;
  delete graph.metadata.visual.presentation.templateAdditionalOptions;
  delete graph.metadata.visual.presentation.themeColors;
}

export async function createAppPaletteIfNeeded(
  graph: GraphDescriptor,
  googleDriveClient?: GoogleDriveClient | null
) {
  const themeId = graph.metadata?.visual?.presentation?.theme;
  if (!themeId) {
    return;
  }

  const theme = graph.metadata?.visual?.presentation?.themes?.[themeId];
  if (!theme || !theme.splashScreen || theme.palette) {
    return;
  }

  let splashUrl: URL | undefined = undefined;
  const { handle } = theme.splashScreen.storedData;
  const BLOB_HANDLE_PATTERN = /^[./]*blobs\/(.+)/;
  const blobMatch = handle.match(BLOB_HANDLE_PATTERN);

  if (blobMatch) {
    const blobId = blobMatch[1];
    if (blobId) {
      splashUrl = new URL(`/board/blobs/${blobId}`, window.location.href);
    }
  } else if (
    handle.startsWith("data:") ||
    handle.startsWith("http:") ||
    handle.startsWith("https:")
  ) {
    splashUrl = new URL(handle);
  } else if (handle.startsWith("drive:")) {
    if (!googleDriveClient) {
      return;
    }
    splashUrl = new URL(handle);
  }

  if (!splashUrl) {
    return;
  }

  console.warn(`[Runtime] Generated theme dynamically`);
  console.warn(`[Runtime] Please regenerate the theme for this app`);

  const imgUrl = await loadImage(googleDriveClient!, splashUrl.href);
  if (!imgUrl) return;

  const img = new Image();
  img.src = imgUrl;
  img.crossOrigin = "anonymous";
  const generatedPalette = await generatePaletteFromImage(img);
  if (generatedPalette) {
    theme.palette = generatedPalette;
  }
}

/**
 * Bundle of graph utility functions for easier import.
 */
/**
 * Type guard: does the value look like a WorkspaceSelectionState?
 */
function isWorkspaceSelection(
  s: WorkspaceSelectionState | Selection
): s is WorkspaceSelectionState {
  return "graphs" in s;
}

/**
 * Wraps a flat Selection into a WorkspaceSelectionState keyed by
 * MAIN_BOARD_ID. This lets graph-utils functions continue to work
 * internally with the per-graph map while callers pass the simpler type.
 */
function selectionFromFlat(s: Selection): WorkspaceSelectionState {
  return {
    graphs: new Map([
      [
        MAIN_BOARD_ID,
        {
          nodes: new Set(s.nodes),
          edges: new Set(s.edges),
          assets: new Set(s.assets),
          assetEdges: new Set(s.assetEdges),
          comments: new Set<string>(),
          references: new Set(),
        },
      ],
    ]),
  };
}

/**
 * Extracts the set of node IDs from a list of EditSpecs (e.g. after
 * paste or duplicate). Only considers "addnode" specs.
 */
export function nodeIdsFromSpec(spec: EditSpec[]): Set<NodeIdentifier> {
  const ids = new Set<NodeIdentifier>();
  for (const item of spec) {
    if (item.type === "addnode") {
      ids.add(item.node.id);
    }
  }
  return ids;
}

export const GraphUtils = {
  applyDefaultThemeInformationIfNonePresent,
  createAppPaletteIfNeeded,
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
  nodeIdsFromSpec,
};
