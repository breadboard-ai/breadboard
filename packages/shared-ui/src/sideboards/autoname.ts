/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AffectedNode,
  EditableGraph,
  EditSpec,
  err,
  GraphChangeEvent,
  ok,
  Outcome,
} from "@google-labs/breadboard";
import { SideBoardRuntime } from "./types";

import AutonameSideboard from "./sideboards-bgl/autoname.bgl.json" with { type: "json" };
import {
  GraphDescriptor,
  GraphIdentifier,
  JsonSerializable,
  LLMContent,
  NodeIdentifier,
  NodeMetadata,
} from "@breadboard-ai/types";

export { Autoname };

const AUTONAMING_LABEL = "@@autonaming@@";

/**
 * The results from Autonaming sideboard.
 * Because this is a generated JSON, be wary
 * about all the fields being present.
 */
type AutonamingResult = {
  analysis?: string;
  suggestions?: {
    graph?: {
      currentTitle?: string;
      suggestedTitle?: string;
      suggestedDescription?: string;
      reasoning?: string;
      note?: string;
    };
    nodes?: {
      id?: string;
      currentTitle?: string;
      suggestedTitle?: string;
      suggestedDescription?: string;
      reasoning?: string;
      note?: string;
    }[];
  };
  rationaleForChanges?: string;
  otherConsiderations?: string;
};

type PendingGraphNodes = {
  graph: GraphDescriptor;
  nodes: Set<NodeIdentifier>;
};

class Autoname {
  #pending: Map<GraphIdentifier, PendingGraphNodes> = new Map();
  #running = false;

  /**
   *
   * @param runtime
   * @param allGraphs - if true, all graphs will be autonamed. Otherwise, only
   * subgraphs will be autonamed.
   */
  constructor(
    public readonly runtime: SideBoardRuntime,
    public readonly allGraphs: boolean
  ) {}

  #addNewAffectedNodes(graph: GraphDescriptor, nodes: AffectedNode[]) {
    for (const node of nodes) {
      const { graphId, id } = node;
      const pending = this.#pending.get(graphId);
      if (!pending) {
        this.#pending.set(graphId, {
          graph,
          nodes: new Set([id]),
        });
        continue;
      }
      pending.nodes.add(id);
      // Update with the latest snapshot of the graph.
      pending.graph = graph;
      // move to the back of the LRU queue
      this.#pending.delete(graphId);
      this.#pending.set(graphId, pending);
    }
  }

  async runTask(
    editor: EditableGraph,
    [graphId, { graph: mainGraph, nodes: nodeSet }]: [
      GraphIdentifier,
      PendingGraphNodes,
    ]
  ): Promise<Outcome<void>> {
    const maybeGraph = graphId ? mainGraph.graphs?.[graphId] : mainGraph;
    if (!maybeGraph) {
      return err(`Unable to get graph with graphId "${graphId}"`);
    }
    // Make a shallow copy.
    const graph = { ...maybeGraph };
    // Remove subgraphs (only matters for mainGraph), so that the autonaming
    // sideboard doesn't have to reason about them.
    delete graph.graphs;
    // Remove modules and assets (for now).
    delete graph.modules;
    delete graph.assets;
    // Account for deletions: filter out nodes that aren't in the graph.
    const aliveNodeSet = new Set(
      graph.nodes.map((descriptor) => descriptor.id)
    );
    const nodes: string[] = [];
    for (const id of nodeSet.values()) {
      if (aliveNodeSet.has(id)) {
        nodes.push(id);
      }
    }

    const abortController = new AbortController();
    let graphChanged = false;
    editor.addEventListener(
      "graphchange",
      () => {
        graphChanged = true;
        abortController.abort();
      },
      { once: true }
    );

    const outputs = await this.runtime.runTask({
      graph: AutonameSideboard,
      context: asLLMContent({ graph, graphId, nodes }),
      url: graph.url,
      signal: abortController.signal,
    });

    if (graphChanged) {
      // Graph changed in the middle of a task, throw away the results.
      console.log("Autonaming results discarded due to graph change");
      return;
    }
    if (!ok(outputs)) {
      console.error("Autonaming error", outputs.$error);
      return outputs;
    }
    const part = outputs.at(0)?.parts.at(0);
    if (!(part && "json" in part)) {
      return err(`Invalid sideboard output`);
    }
    const result = part.json as AutonamingResult;
    console.log("AUTONAMING RESULT", result);
    const nodeSuggestions = result.suggestions?.nodes;
    const edits: EditSpec[] = [];

    // Process node suggestions.
    if (nodeSuggestions) {
      const nodeEdits = nodeSuggestions
        .map((node) => {
          const title = node.suggestedTitle;
          const description = node.suggestedDescription;
          const id = node.id;
          if (!title || !description || !id) return null;
          const metadata: NodeMetadata = { title, description };
          return {
            type: "changemetadata",
            metadata,
            id,
            graphId,
          };
        })
        .filter(Boolean) as EditSpec[];
      edits.push(...nodeEdits);
    }

    if (!graph.metadata?.userModified) {
      const graphSuggestions = result.suggestions?.graph;
      if (graphSuggestions) {
        const { suggestedTitle: title, suggestedDescription: description } =
          graphSuggestions;
        if (title || description) {
          edits.push({
            graphId,
            type: "changegraphmetadata",
            title,
            description,
          });
        }
      }
    }

    const editing = await editor.edit(edits, AUTONAMING_LABEL);
    if (!editing.success) {
      console.error("Editing failed", editing.error);
      return err(editing.error);
    }
  }

  async addTask(
    editor: EditableGraph,
    evt: GraphChangeEvent
  ): Promise<Outcome<void>> {
    const { graph, affectedNodes } = evt;

    // Early return for all the cases where we don't want to kick off the
    // autonaming task.
    if (
      evt.visualOnly ||
      evt.changeType === "history" ||
      evt.label === AUTONAMING_LABEL ||
      graph.main
    ) {
      return;
    }

    this.#addNewAffectedNodes(graph, affectedNodes);

    if (this.#running) return;

    console.log("PENDING SIZE", this.#pending.size);

    try {
      this.#running = true;
      for (;;) {
        const entry = this.#pending.entries().next().value;
        if (!entry) return;
        const [graphId] = entry;
        // Clear out the pending store for the graphId, so that
        // if new affectedNodes come in for this graphId, they would
        // be added as a new entry.
        this.#pending.delete(graphId);
        // Don't autoname main graph when asked.
        if (!this.allGraphs && !graphId) continue;

        const runningTask = await this.runTask(editor, entry);
        if (!ok(runningTask)) {
          // Report error, but keep going.
          console.error(`Autonaming task failed: ${runningTask.$error}`);
        }
      }
    } finally {
      this.#running = false;
    }
  }
}

function asLLMContent<T>(o: T): LLMContent[] {
  return [{ parts: [{ json: o as JsonSerializable }] }];
}
