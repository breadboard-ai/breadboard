/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EditableGraph,
  EditSpec,
  GraphChangeEvent,
  ok,
  Outcome,
} from "@google-labs/breadboard";
import { SideBoardRuntime } from "./types";

import Autoname from "../bgl/autoname.bgl.json" with { type: "json" };
import {
  JsonSerializable,
  LLMContent,
  NodeMetadata,
} from "@breadboard-ai/types";

export { graphAutonamingTask };

const AUTONAMING_LABEL = "@@autonaming@@";

/**
 * The results from Autonaming sideboard.
 * Because this is a generated JSON, be wary
 * about all the fields being present.
 */
export type AutonamingResult = {
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

async function graphAutonamingTask(
  runtime: SideBoardRuntime,
  editor: EditableGraph,
  evt: GraphChangeEvent
): Promise<Outcome<void>> {
  const { graph, affectedGraphs, affectedNodes } = evt;

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

  // Make sense of all the changes.
  // - Each entry in `affectedNodes` is a request to re-evaluate the title
  //   and the description of the specified node.
  // - Each entry in `affectedGraphs` is a requestst to re-evaluate the title
  //   and the description of the specified graph.
  // First, process `affectedNodes` -- this will create updated titles and
  // descriptions.
  // Then, process `affectedGraphs` -- this will rely on the updated node
  // titles and descriptions to create a better graph title/description.

  // TODO: Figure out a super-efficient way to do this.
  // Doing it in isolation seems right for graphs -- only send each subgraph,
  // separately. Filter out all the subgraphs for the main graph
  // Doing it in batches feels more efficient, but also more error-prone.

  // Two approaches
  // 1) send the whole thing out to the sideboard and let the sideboard
  // figure it out.
  // 2) make sense of the whole thing here and only send out targeted renaming
  // prompts.

  const outputs = await runtime.runTask({
    // TODO: The Autonaming Graph goes here
    graph: Autoname,
    context: asLLMContent({ graph, affectedGraphs, affectedNodes }),
  });
  console.log("RESULT", outputs);
  if (!ok(outputs)) {
    // TODO: handle error somehow..
    return;
  }
  const part = outputs.at(0)?.parts.at(0);
  if (!(part && "json" in part)) {
    // TODO: handle error
    return;
  }
  const result = part.json as AutonamingResult;
  const nodes = result.suggestions?.nodes;
  if (nodes) {
    const edits = nodes
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
          graphId: "",
        };
      })
      .filter(Boolean) as EditSpec[];
    const result = await editor.edit(edits, AUTONAMING_LABEL);
    if (!result.success) {
      console.error("FAILED", result.error);
    }
  }
  // const result = await editor.edit(
  //   [{ type: "changegraphmetadata", metadata, graphId }],
  //   label
  // );
  // if (!result.success) {
  //   // TODO: handle error
  //   return;
  // }
}

function asLLMContent<T>(o: T): LLMContent[] {
  return [{ parts: [{ json: o as JsonSerializable }] }];
}
