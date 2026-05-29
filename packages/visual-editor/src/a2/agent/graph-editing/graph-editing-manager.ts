/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditableGraph,
  GraphMetadata,
  NodeConfiguration,
  NodeMetadata,
  Outcome,
} from "@breadboard-ai/types";
import { UpdateNode } from "../../../ui/transforms/update-node.js";
import { computePositions } from "./layout-graph.js";
import type { InPort } from "../../../ui/transforms/autowire-in-ports.js";
import type { ApplyEditsResponse } from "./types.js";
import type { TransformDescriptor } from "../agent-event.js";
import type { EditSpec } from "@breadboard-ai/types";

export { GraphEditingManager };
export type { GraphThemeGenerationContext, GraphThemeGenerator };

type GraphThemeGenerationContext = {
  title: string;
  description: string;
  userInstruction: string;
  signal?: AbortSignal;
};

type GraphThemeGenerator = (
  context: GraphThemeGenerationContext
) => Promise<Outcome<unknown>>;

/**
 * Encapsulates policy-driven Graph Editing for both production and evaluation.
 * Decouples the mutation policy from UI/SCA and environment-specific triggers.
 */
class GraphEditingManager {
  constructor(
    private readonly editor: EditableGraph,
    private readonly themeGenerator?: GraphThemeGenerator
  ) {}

  async applyEdits(
    payload: {
      edits?: EditSpec[];
      transform?: TransformDescriptor;
      label?: string;
    },
    options?: {
      signal?: AbortSignal;
      onNodeConfigChanged?: (config: {
        nodeId: string;
        graphId: string;
        configuration: NodeConfiguration;
        titleUserModified: boolean;
      }) => void;
      onThemeUpdated?: (metadata: GraphMetadata) => void;
    }
  ): Promise<ApplyEditsResponse> {
    const { editor, themeGenerator } = this;
    const { edits, transform, label } = payload;

    if (edits) {
      const result = await editor.edit(edits, label || "Apply Edits");
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true };
    }

    if (transform) {
      switch (transform.kind) {
        case "updateNode": {
          const t = new UpdateNode(
            transform.nodeId,
            transform.graphId,
            transform.configuration as NodeConfiguration | null,
            transform.metadata as NodeMetadata | null,
            transform.portsToAutowire as InPort[] | null
          );
          const result = await editor.apply(t);

          if (result.success && transform.configuration && options?.onNodeConfigChanged) {
            options.onNodeConfigChanged({
              nodeId: transform.nodeId,
              graphId: transform.graphId,
              configuration: transform.configuration as NodeConfiguration,
              titleUserModified: t.titleUserModified,
            });
          }

          if (!result.success) {
            return { success: false, error: result.error };
          }
          return { success: true };
        }

        case "layoutGraph": {
          const graph = editor.raw();
          const positions = computePositions(graph.nodes ?? [], graph.edges ?? []);
          const edits: EditSpec[] = [];
          for (const [nodeId, { x, y }] of positions) {
            const node = graph.nodes?.find((n) => n.id === nodeId);
            const existingMetadata = node?.metadata ?? {};
            const existingVisual = (existingMetadata.visual ?? {}) as Record<string, unknown>;
            edits.push({
              type: "changemetadata",
              id: nodeId,
              graphId: "",
              metadata: {
                ...existingMetadata,
                visual: { ...existingVisual, x, y },
              },
            });
          }
          if (edits.length > 0) {
            const result = await editor.edit(edits, "Layout graph");
            if (!result.success) {
              return { success: false, error: result.error };
            }
          }
          return { success: true };
        }

        case "updateGraphProperties": {
          const { title, description, themeIntent } = transform;
          let metadata: GraphMetadata | undefined;

          if (themeIntent && themeGenerator) {
            const rawGraph = editor.raw();
            const promptTitle = title ?? rawGraph.title ?? "Application";
            const promptDesc = description ?? rawGraph.description ?? "";

            const appThemeResult = await themeGenerator({
              title: promptTitle,
              description: promptDesc,
              userInstruction: themeIntent,
              signal: options?.signal,
            });

            const errPayload = appThemeResult as Record<string, unknown>;
            if (
              errPayload &&
              typeof errPayload === "object" &&
              "$error" in errPayload &&
              typeof errPayload.$error === "string"
            ) {
              return {
                success: false,
                error: `Theme generation failed: ${errPayload.$error}`,
              };
            }

            metadata = editor.raw().metadata ?? {};
            metadata.visual ??= {};
            metadata.visual.presentation ??= {};
            metadata.visual.presentation.themes ??= {};

            const id = globalThis.crypto.randomUUID();
            const themes = metadata.visual.presentation.themes as Record<string, unknown>;
            themes[id] = appThemeResult;
            metadata.visual.presentation.theme = id;

            if (options?.onThemeUpdated) {
              options.onThemeUpdated(metadata);
            }
          }

          const result = await editor.edit(
            [
              {
                type: "changegraphmetadata",
                title: title ?? undefined,
                description: description ?? undefined,
                metadata,
                graphId: "",
              },
            ],
            "Updating graph properties"
          );

          if (!result.success) {
            return { success: false, error: result.error };
          }
          return { success: true };
        }

        default: {
          const kind = (transform as { kind: string }).kind ?? "unknown";
          return {
            success: false,
            error: `Unsupported transform kind: ${kind}`,
          };
        }
      }
    }

    return { success: false, error: "Invalid applyEdits payload" };
  }
}
