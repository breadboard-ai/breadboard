/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeDescriptor, NodeValue } from "@breadboard-ai/types";
import type { InPort } from "../../../ui/transforms/autowire-in-ports.js";
import z from "zod";
import { defineFunction, mapDefinitions } from "../function-definition.js";
import type { FunctionGroup } from "../types.js";
import { A2_TOOLS } from "../../a2-registry.js";
import {
  bind,
  addNode,
  changeNodeConfiguration,
} from "../../../sca/actions/graph/graph-actions.js";
import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { layoutGraph } from "./layout-graph.js";

export { getGraphEditingFunctionGroup };

// =============================================================================
// Constants
// =============================================================================

const GRAPH_GET_OVERVIEW = "graph_get_overview";
const GRAPH_REMOVE_STEP = "graph_remove_step";
const GRAPH_CREATE_STEP = "create_step";
const GRAPH_EDIT_STEP_PROMPT = "edit_step_prompt";

/**
 * The Generate component URL from A2_COMPONENTS.
 */
const GENERATE_COMPONENT_URL = "embed://a2/generate.bgl.json#module:main";

/**
 * Build the list of available tool names for the instruction text.
 */
const TOOL_NAMES = A2_TOOLS.map(
  ([, tool]) =>
    `- ${(tool.title ?? "").toLowerCase().replace(/\s+/g, "-")} — ${tool.description}`
).join("\n");

const PROMPT_DESCRIPTION = `The prompt for the step, written as plain text with \
optional markup tags to express connections and tool usage:
- <parent src="STEP_ID" /> — wire an incoming connection from an existing step. \
STEP_ID must be the ID of a step obtained from graph_get_overview.
- <tool name="TOOL_NAME" /> — attach a tool to the step. Available tools:
${TOOL_NAMES}
- <file src="PATH" /> — reference a file asset.
- <a href="URL">TITLE</a> — add a route (navigation link).

Any text outside of these tags is the prompt content.`;

// =============================================================================
// Instruction
// =============================================================================

function buildInstruction(): string {
  return `## Graph Editing

You can inspect, create, edit, and remove steps in the current graph.

### Writing Prompts
Use plain text for the prompt content. To express connections and tool usage, \
use these markup tags:

- \`<parent src="STEP_ID" />\` — wire an incoming connection from an existing step.
- \`<tool name="TOOL_NAME" />\` — attach a tool capability to the step.
- \`<file src="PATH" />\` — reference a file asset.
- \`<a href="URL">TITLE</a>\` — add a route (navigation link).

### Available Tools
${TOOL_NAMES}

### Editing Tips
- Use graph_get_overview first to understand the current graph.
- When creating a step, reference existing steps with <parent> to wire connections.
- Steps are always created as Generate steps with Agent mode.
`;
}

// =============================================================================
// Function definitions
// =============================================================================

function defineGraphEditingFunctions(translator: EditingAgentPidginTranslator) {
  function requireEditor() {
    const { controller } = bind;
    const editor = controller.editor.graph.editor;
    if (!editor) {
      throw new Error("No active graph to edit");
    }
    return editor;
  }

  /**
   * Creates a resolver that looks up node titles from the current graph.
   */
  function nodeTitleResolver(): (nodeId: string) => string | undefined {
    const editor = requireEditor();
    const inspector = editor.inspect("");
    return (nodeId: string) => {
      const node = inspector.nodeById(nodeId);
      return node?.metadata()?.title;
    };
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
    // create_step
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_CREATE_STEP,
        title: "Creating step",
        icon: "add_circle",
        description:
          "Create a new Generate step with a prompt. Use <parent> tags in the prompt to wire connections from existing steps.",
        parameters: {
          title: z.string().describe("A descriptive title for the step"),
          prompt: z.string().describe(PROMPT_DESCRIPTION),
        },
        response: {
          step_id: z.string().describe("The ID of the newly created step"),
        },
      },
      async ({ title, prompt }) => {
        const promptContent = translator.fromPidgin(
          prompt,
          nodeTitleResolver()
        );

        const stepId = globalThis.crypto.randomUUID();
        const node: NodeDescriptor = {
          id: stepId,
          type: GENERATE_COMPONENT_URL,
          metadata: { title },
          configuration: {
            "generation-mode": "agent",
            config$prompt: promptContent as unknown as NodeValue,
          },
        };

        await addNode(node, "");

        // Auto-wire edges from <parent> references
        const ports = extractParentPorts(prompt, translator);
        if (ports.length > 0) {
          await changeNodeConfiguration(
            stepId,
            "",
            { config$prompt: promptContent as unknown as NodeValue },
            null,
            ports
          );
        }

        // Re-layout all nodes based on updated topology
        const graph = requireEditor().raw();
        await layoutGraph(graph.nodes ?? [], graph.edges ?? []);

        return { step_id: stepId };
      }
    ),

    // =========================================================================
    // edit_step_prompt
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_EDIT_STEP_PROMPT,
        title: "Editing step prompt",
        icon: "edit",
        description:
          "Update an existing step's prompt. Use <parent> tags to change connections.",
        parameters: {
          step_id: z.string().describe("The ID of the step to edit"),
          prompt: z.string().describe(PROMPT_DESCRIPTION),
        },
        response: {
          success: z.boolean(),
        },
      },
      async ({ step_id, prompt }) => {
        const editor = requireEditor();
        const inspector = editor.inspect("");
        const node = inspector.nodeById(step_id);
        if (!node) {
          return { $error: `Step "${step_id}" not found` };
        }

        const promptContent = translator.fromPidgin(
          prompt,
          nodeTitleResolver()
        );
        const ports = extractParentPorts(prompt, translator);

        // Update configuration and auto-wire edges in one transform
        await changeNodeConfiguration(
          step_id,
          "",
          { config$prompt: promptContent as unknown as NodeValue },
          null,
          ports
        );

        // Re-layout all nodes based on updated topology
        const graph = requireEditor().raw();
        await layoutGraph(graph.nodes ?? [], graph.edges ?? []);

        return { success: true };
      }
    ),
  ];
}

// =============================================================================
// Helpers
// =============================================================================

const PARENT_SRC_REGEX = /<parent\s+src\s*=\s*"([^"]*)"\s*\/>/g;

/**
 * Extract parent ports from pidgin text. Each <parent src="STEP_ID" /> tag
 * becomes an InPort for auto-wiring.
 */
function extractParentPorts(
  pidginText: string,
  translator: EditingAgentPidginTranslator
): InPort[] {
  const ports: InPort[] = [];
  const seen = new Set<string>();

  for (const match of pidginText.matchAll(PARENT_SRC_REGEX)) {
    const handle = match[1];
    // The handle could be a raw step ID (from the LLM) or a translator handle
    const nodeId = translator.getNodeId(handle) ?? handle;
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);
    ports.push({ path: nodeId, title: handle });
  }

  return ports;
}

// =============================================================================
// Function group factory
// =============================================================================

function getGraphEditingFunctionGroup(
  translator: EditingAgentPidginTranslator
): FunctionGroup {
  return {
    ...mapDefinitions(defineGraphEditingFunctions(translator)),
    instruction: buildInstruction(),
  };
}
