/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetPath,
  GraphIdentifier,
  NodeIdentifier,
} from "@breadboard-ai/types";
import {
  Components,
  FastAccess,
  FastAccessContext,
  GeneratedAsset,
  GeneratedAssetIdentifier,
  GraphAsset,
  ProjectInternal,
  Tool,
} from "./types";
import { err, ok, Outcome } from "@google-labs/breadboard";

export { ReactiveFastAccess };

class ReactiveFastAccess implements FastAccess {
  #project: ProjectInternal;
  #context: FastAccessContext | null = null;

  constructor(
    project: ProjectInternal,
    public readonly graphAssets: Map<AssetPath, GraphAsset>,
    public readonly generatedAssets: Map<
      GeneratedAssetIdentifier,
      GeneratedAsset
    >,
    public readonly tools: Map<string, Tool>,
    public readonly components: Map<GraphIdentifier, Components>
  ) {
    this.#project = project;
  }

  setContext(context: FastAccessContext) {
    this.#context = context;
  }

  selectGraphAsset(path: AssetPath): Outcome<string> {
    if (!this.graphAssets.has(path)) {
      return err(`Path "${path}" was not found in assets.`);
    }

    this.#context = null;

    return `{{ asset | path: "${path}" }}`;
  }

  selectTool(url: string): Outcome<string> {
    if (!this.tools.has(url)) {
      return err(`Tool "${url}" is not a known tool.`);
    }

    this.#context = null;

    return `{{ tool | url: "${url}" }}`;
  }

  async selectComponent(
    graphId: GraphIdentifier,
    from: NodeIdentifier,
    to: NodeIdentifier
  ): Promise<Outcome<string>> {
    // Find the appropriate output port
    const outputPortId = this.#project.findOutputPortId(graphId, from);
    if (!ok(outputPortId)) {
      return outputPortId;
    }
    const { id: out, title: inputPortId } = outputPortId;
    // Add a new edge
    const editing = await this.#project.edit(
      [
        {
          type: "addedge",
          edge: {
            from,
            to,
            in: `p-z-${inputPortId}`,
            out,
          },
          graphId,
        },
      ],
      `Adding an edge from component "${from}"`
    );
    if (!ok(editing)) {
      return editing;
    }
    return `{{ in | id: "${inputPortId}" }}`;
  }
}
