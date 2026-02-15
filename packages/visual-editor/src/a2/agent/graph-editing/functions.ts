/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Edge,
  NodeConfiguration,
  NodeDescriptor,
} from "@breadboard-ai/types";
import z from "zod";
import { defineFunction, mapDefinitions } from "../function-definition.js";
import type { FunctionGroup } from "../types.js";
import { A2_COMPONENTS, A2_TOOLS } from "../../a2-registry.js";
import {
  bind,
  addNode,
  changeEdge,
  changeNodeConfiguration,
} from "../../../sca/actions/graph/graph-actions.js";

export { getGraphEditingFunctionGroup };

// =============================================================================
// Constants
// =============================================================================

const GRAPH_GET_OVERVIEW = "graph_get_overview";
const GRAPH_DESCRIBE_STEP_TYPE = "graph_describe_step_type";
const GRAPH_ADD_STEP = "graph_add_step";
const GRAPH_REMOVE_STEP = "graph_remove_step";
const GRAPH_UPDATE_STEP = "graph_update_step";
const GRAPH_CONNECT_STEPS = "graph_connect_steps";

/**
 * Map from user-friendly step type names to the component URLs in the registry.
 */
const STEP_TYPE_MAP: Record<string, string> = {};
for (const component of A2_COMPONENTS) {
  const key = component.title.toLowerCase().replace(/\s+/g, "_");
  STEP_TYPE_MAP[key] = component.url;
}

// =============================================================================
// Instruction
// =============================================================================

function buildInstruction(): string {
  const componentLines = A2_COMPONENTS.map(
    (c: (typeof A2_COMPONENTS)[number]) =>
      `- "${c.title.toLowerCase().replace(/\s+/g, "_")}" — ${c.description}`
  );

  const toolLines = A2_TOOLS.map(
    ([, tool]: (typeof A2_TOOLS)[number]) => `- ${tool.title}`
  );

  return `## Graph Editing

You can inspect and modify the current graph (a flow of connected steps).

### Available Step Types
${componentLines.join("\n")}

### Available Tools (attachable to Generate steps)
${toolLines.join("\n")}

### Editing Tips
- Use graph_get_overview to understand the current graph before making changes.
- When adding a step, provide a descriptive title.
- Steps are connected via edges: an edge runs from an output port of one step to an input port of another.
- Port names default to "*" (wildcard) which auto-wires the primary ports.
`;
}

// =============================================================================
// Function definitions
// =============================================================================

function defineGraphEditingFunctions() {
  function requireEditor() {
    const { controller } = bind;
    const editor = controller.editor.graph.editor;
    if (!editor) {
      throw new Error("No active graph to edit");
    }
    return editor;
  }

  return [
    // =========================================================================
    // graph_get_overview
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_GET_OVERVIEW,
        title: "Inspecting graph",
        icon: "visibility",
        description:
          "Get an overview of the current graph structure: all steps, their configurations, and connections between them.",
        parameters: {},
        response: {
          overview: z.string().describe("JSON summary of the graph structure"),
        },
      },
      async () => {
        const editor = requireEditor();
        const graph = editor.raw();

        const steps = (graph.nodes ?? []).map((node) => ({
          id: node.id,
          type: node.type,
          title: node.metadata?.title,
          description: node.metadata?.description,
          configuration: node.configuration,
        }));

        const edges = (graph.edges ?? []).map((edge) => ({
          from: edge.from,
          to: edge.to,
          from_port: edge.out,
          to_port: edge.in,
        }));

        return {
          overview: JSON.stringify(
            {
              title: graph.title,
              description: graph.description,
              steps,
              edges,
            },
            null,
            2
          ),
        };
      }
    ),

    // =========================================================================
    // graph_describe_step_type
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_DESCRIBE_STEP_TYPE,
        title: "Describing step type",
        icon: "info",
        description:
          "Get the detailed input/output schema for a step type. Use this when you need to know what configuration a step accepts.",
        parameters: {
          step_type: z
            .string()
            .describe(
              `The step type to describe. One of: ${Object.keys(STEP_TYPE_MAP).join(", ")}`
            ),
        },
        response: {
          description: z.string().describe("JSON description of the step type"),
        },
      },
      async ({ step_type }) => {
        const url = STEP_TYPE_MAP[step_type];
        if (!url) {
          return {
            $error: `Unknown step type "${step_type}". Available types: ${Object.keys(STEP_TYPE_MAP).join(", ")}`,
          };
        }

        const component = A2_COMPONENTS.find(
          (c: (typeof A2_COMPONENTS)[number]) => c.url === url
        );
        if (!component) {
          return { $error: `Component not found for type "${step_type}"` };
        }

        // Call the component's describe function to get dynamic schema
        let schema: unknown;
        try {
          schema = await component.describe({ inputs: {} });
        } catch {
          // If describe fails, we still return basic info
        }

        return {
          description: JSON.stringify(
            {
              step_type,
              title: component.title,
              description: component.description,
              schema,
            },
            null,
            2
          ),
        };
      }
    ),

    // =========================================================================
    // graph_add_step
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_ADD_STEP,
        title: "Adding step",
        icon: "add_circle",
        description:
          "Add a new step to the graph. Returns the ID of the created step.",
        parameters: {
          step_type: z
            .string()
            .describe(
              `The type of step to add. One of: ${Object.keys(STEP_TYPE_MAP).join(", ")}`
            ),
          title: z.string().describe("A descriptive title for the step"),
          configuration: z
            .string()
            .optional()
            .describe(
              "Optional JSON configuration for the step (e.g., prompt text)"
            ),
          connect_after: z
            .string()
            .optional()
            .describe(
              "Optional: ID of an existing step to connect this new step after"
            ),
        },
        response: {
          step_id: z.string().describe("The ID of the newly created step"),
        },
      },
      async ({ step_type, title, configuration, connect_after }) => {
        const url = STEP_TYPE_MAP[step_type];
        if (!url) {
          return {
            $error: `Unknown step type "${step_type}". Available types: ${Object.keys(STEP_TYPE_MAP).join(", ")}`,
          };
        }

        const stepId = globalThis.crypto.randomUUID();
        const config: NodeConfiguration | undefined = configuration
          ? (JSON.parse(configuration) as NodeConfiguration)
          : undefined;
        const node: NodeDescriptor = {
          id: stepId,
          type: url,
          metadata: { title },
          ...(config ? { configuration: config } : {}),
        };

        await addNode(node, "");

        // Optionally wire the new step after an existing one
        if (connect_after) {
          try {
            await changeEdge("add", {
              from: connect_after,
              to: stepId,
              out: "*",
              in: "*",
            });
          } catch {
            // If auto-wiring fails, the step is still created
          }
        }

        return { step_id: stepId };
      }
    ),

    // =========================================================================
    // graph_remove_step
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_REMOVE_STEP,
        title: "Removing step",
        icon: "delete",
        description:
          "Remove a step from the graph. Also removes all edges connected to it.",
        parameters: {
          step_id: z.string().describe("The ID of the step to remove"),
        },
        response: {
          success: z.boolean(),
        },
      },
      async ({ step_id }) => {
        const editor = requireEditor();

        // Use editor.edit directly (no SCA Action for removenode yet)
        const result = await editor.edit(
          [{ type: "removenode", id: step_id, graphId: "" }],
          `Remove step: ${step_id}`
        );

        if (!result.success) {
          return { $error: `Failed to remove step "${step_id}"` };
        }

        return { success: true };
      }
    ),

    // =========================================================================
    // graph_update_step
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_UPDATE_STEP,
        title: "Updating step",
        icon: "edit",
        description:
          "Update a step's configuration, title, and/or description.",
        parameters: {
          step_id: z.string().describe("The ID of the step to update"),
          configuration: z
            .string()
            .optional()
            .describe("New configuration as JSON to merge"),
          title: z.string().optional().describe("New title for the step"),
          description: z
            .string()
            .optional()
            .describe("New description for the step"),
        },
        response: {
          success: z.boolean(),
        },
      },
      async ({ step_id, configuration, title, description }) => {
        const editor = requireEditor();

        // If title or description changed, update metadata first
        if (title !== undefined || description !== undefined) {
          const inspector = editor.inspect("");
          const node = inspector.nodeById(step_id);
          if (!node) {
            return { $error: `Step "${step_id}" not found` };
          }
          const existingMetadata = node.metadata() ?? {};
          const metadata = {
            ...existingMetadata,
            ...(title !== undefined ? { title } : {}),
            ...(description !== undefined ? { description } : {}),
          };
          const result = await editor.edit(
            [{ type: "changemetadata", id: step_id, graphId: "", metadata }],
            `Update step metadata: ${step_id}`
          );
          if (!result.success) {
            return {
              $error: `Failed to update metadata for step "${step_id}"`,
            };
          }
        }

        // If configuration changed, use the SCA Action
        if (configuration) {
          const configPart = JSON.parse(configuration) as NodeConfiguration;
          await changeNodeConfiguration(step_id, "", configPart);
        }

        return { success: true };
      }
    ),

    // =========================================================================
    // graph_connect_steps
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_CONNECT_STEPS,
        title: "Connecting steps",
        icon: "link",
        description: "Add or remove a connection (edge) between two steps.",
        parameters: {
          action: z
            .enum(["add", "remove"])
            .describe('Whether to "add" or "remove" the connection'),
          from_step_id: z.string().describe("The source step ID"),
          to_step_id: z.string().describe("The destination step ID"),
          from_port: z
            .string()
            .optional()
            .describe(
              'Source output port name (defaults to "*" for auto-wiring)'
            ),
          to_port: z
            .string()
            .optional()
            .describe(
              'Destination input port name (defaults to "*" for auto-wiring)'
            ),
        },
        response: {
          success: z.boolean(),
        },
      },
      async ({ action, from_step_id, to_step_id, from_port, to_port }) => {
        const edge: Edge = {
          from: from_step_id,
          to: to_step_id,
          out: from_port ?? "*",
          in: to_port ?? "*",
        };

        try {
          await changeEdge(action, edge);
        } catch (e) {
          return {
            $error: `Failed to ${action} connection: ${(e as Error).message}`,
          };
        }

        return { success: true };
      }
    ),
  ];
}

// =============================================================================
// Function group factory
// =============================================================================

function getGraphEditingFunctionGroup(): FunctionGroup {
  return {
    ...mapDefinitions(defineGraphEditingFunctions()),
    instruction: buildInstruction(),
  };
}
