/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EditSpec,
  GraphDescriptor,
  NodeConfiguration,
  NodeDescriptor,
  NodeValue,
} from "@breadboard-ai/types";
import z from "zod";
import type { InPort } from "../../../ui/transforms/autowire-in-ports.js";
import { segments } from "./instructions/generated.js";
import { A2_TOOLS } from "../../a2-registry.js";
import type { AgentEventSink } from "../agent-event-sink.js";
import { defineFunction, mapDefinitions } from "../function-definition.js";
import type { FunctionGroup } from "../types.js";
import type { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { graphOverviewYaml } from "./graph-overview.js";
import {
  GENERATE_COMPONENT_URL,
  USER_INPUT_COMPONENT_URL,
  OUTPUT_COMPONENT_URL,
  LEGACY_OPTION_MAP,
} from "./constants.js";
import type { ApplyEditsResponse, ReadGraphResponse } from "./types.js";

export { getGraphEditingFunctionGroup };

// =============================================================================
// Constants
// =============================================================================

const GRAPH_GET_OVERVIEW = "graph_get_overview";
const GRAPH_REMOVE_STEP = "graph_remove_step";
const GRAPH_UPSERT_AGENT_STEP = "upsert_agent_step";
const GRAPH_UPSERT_LEGACY_STEP = "upsert_legacy_step";
const GRAPH_EDIT_PROPERTIES = "graph_edit_properties";

const VALID_LEGACY_STEP_TYPES = [
  "user-input",
  "output",
  "text-3-flash",
  "text-3-pro",
  "image",
  "image-pro",
  "audio",
  "video",
  "music",
] as const;

/**
 * Build the list of available tool names for the instruction text.
 */
const TOOL_NAMES = A2_TOOLS.map(
  ([, tool]) =>
    `- ${(tool.title ?? "").toLowerCase().replace(/\s+/g, "-")} — ${tool.description}`
).join("\n");

/**
 * Build a glossary mapping internal tag syntax to user-facing chip names.
 * Used in the system prompt so the agent can explain concepts using the
 * terminology the user sees in the UI.
 */
const TOOL_GLOSSARY = A2_TOOLS.map(([, tool]) => {
  const tagName = (tool.title ?? "").toLowerCase().replace(/\s+/g, "-");
  return `- \`<tool name="${tagName}" />\` → "${tool.title}" chip`;
}).join("\n");

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
  return segments
    .join("\n\n")
    .replaceAll("{{TOOL_NAMES}}", TOOL_NAMES)
    .replaceAll("{{TOOL_GLOSSARY}}", TOOL_GLOSSARY)
    .replaceAll("{{PROMPT_DESCRIPTION}}", PROMPT_DESCRIPTION);
}

// =============================================================================
// Function definitions
// =============================================================================

function defineGraphEditingFunctions(
  sink: AgentEventSink,
  translator: EditingAgentPidginTranslator
) {
  /**
   * Reads the current graph via the suspend mechanism.
   */
  async function readGraph(): Promise<GraphDescriptor> {
    return sink
      .suspend<ReadGraphResponse>({
        readGraph: {
          requestId: crypto.randomUUID(),
        },
      })
      .then((r) => r.graph);
  }

  /**
   * Applies edits via the suspend mechanism, waiting for confirmation.
   */
  async function applyEdits(
    edits: EditSpec[],
    label: string
  ): Promise<ApplyEditsResponse> {
    return sink.suspend<ApplyEditsResponse>({
      applyEdits: {
        requestId: crypto.randomUUID(),
        edits,
        label,
      },
    });
  }

  /**
   * Applies a complex transform (UpdateNode) via the suspend mechanism.
   */
  async function applyUpdateNode(
    nodeId: string,
    graphId: string,
    configuration: Record<string, unknown> | null,
    metadata: Record<string, unknown> | null,
    portsToAutowire: InPort[] | null
  ): Promise<ApplyEditsResponse> {
    return sink.suspend<ApplyEditsResponse>({
      applyEdits: {
        requestId: crypto.randomUUID(),
        label: `Update step: ${nodeId}`,
        transform: {
          kind: "updateNode",
          nodeId,
          graphId,
          configuration,
          metadata,
          portsToAutowire:
            portsToAutowire?.map((p) => ({
              path: p.path,
              title: p.title,
            })) ?? null,
        },
      },
    });
  }

  /**
   * Triggers a layout via the suspend mechanism.
   */
  async function applyLayout(): Promise<ApplyEditsResponse> {
    return sink.suspend<ApplyEditsResponse>({
      applyEdits: {
        requestId: crypto.randomUUID(),
        label: "Layout graph",
        transform: { kind: "layoutGraph" },
      },
    });
  }

  /**
   * Applies an updateGraphProperties transform via the suspend mechanism.
   */
  async function applyUpdateGraphProperties(
    title?: string,
    description?: string,
    themeIntent?: string
  ): Promise<ApplyEditsResponse> {
    return sink.suspend<ApplyEditsResponse>({
      applyEdits: {
        requestId: crypto.randomUUID(),
        label: "Update graph properties",
        transform: {
          kind: "updateGraphProperties",
          title,
          description,
          themeIntent,
        },
      },
    });
  }

  /**
   * Creates a resolver that looks up node titles from the current graph.
   * Reads the graph via suspend to get the current state.
   */
  async function nodeTitleResolver(): Promise<
    (nodeId: string) => string | undefined
  > {
    const graph = await readGraph();
    return (nodeId: string) => {
      const node = graph.nodes?.find((n) => n.id === nodeId);
      return node?.metadata?.title;
    };
  }

  /**
   * Resolves pidgin prompt markup references into standard configuration data and auto-wire InPorts.
   */
  async function resolvePromptAndPorts(
    prompt: string,
    translator: EditingAgentPidginTranslator
  ) {
    const resolver = await nodeTitleResolver();
    const promptContent = translator.fromPidgin(prompt, resolver);
    const ports = extractParentPorts(prompt, translator);
    return { promptContent, ports };
  }

  /**
   * Resolves a step_id handle into the raw NodeDescriptor and ensures its existence.
   */
  async function resolveAndValidateNode(
    step_id: string,
    translator: EditingAgentPidginTranslator
  ): Promise<{ error: string } | { resolvedId: string; node: NodeDescriptor }> {
    const resolvedId = translator.getNodeId(step_id) ?? step_id;
    const graph = await readGraph();
    const node = graph.nodes?.find((n) => n.id === resolvedId);
    if (!node) {
      return { error: `Step "${step_id}" not found` };
    }
    return { resolvedId, node };
  }

  type NodeSpec = {
    type: string;
    configuration: Record<string, unknown>;
    portsKey: string;
  };

  /**
   * Maps a descriptive legacy step_type to its core Graph configuration.
   */
  function buildNodeSpec(stepType: string, promptContent: unknown): NodeSpec {
    if (stepType === "user-input") {
      return {
        type: USER_INPUT_COMPONENT_URL,
        configuration: {
          description: promptContent,
        },
        portsKey: "description",
      };
    }
    if (stepType === "output") {
      return {
        type: OUTPUT_COMPONENT_URL,
        configuration: {
          text: promptContent,
        },
        portsKey: "text",
      };
    }
    return {
      type: GENERATE_COMPONENT_URL,
      configuration: {
        "generation-mode": stepType,
        config$prompt: promptContent,
      },
      portsKey: "config$prompt",
    };
  }

  /**
   * Reflows graph elements and encodes raw IDs as handles back for the Agent context.
   */
  async function reLayoutAndReturnHandle(
    stepId: string,
    translator: EditingAgentPidginTranslator
  ) {
    await applyLayout();
    const handle = translator.getOrCreateHandle(stepId);
    return { step_id: handle };
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
          "Get an overview of the current graph: steps (with titles, prompts) and connections.",
        parameters: {},
        response: {
          overview: z
            .string()
            .describe("Compact YAML overview of the graph structure"),
        },
      },
      async () => {
        const graph = await readGraph();
        const overview = graphOverviewYaml(
          graph,
          graph.nodes ?? [],
          graph.edges ?? [],
          translator
        );
        return { overview };
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
          step_id: z
            .string()
            .describe("The handle of the step to remove (e.g. node-1)"),
        },
        response: {
          success: z.boolean(),
          error: z
            .string()
            .optional()
            .describe(
              "If an error has occurred, will contain a description of the error"
            ),
        },
      },
      async ({ step_id }) => {
        // Resolve pidgin handle (e.g. "node-1") to raw ID if needed
        const resolvedId = translator.getNodeId(step_id) ?? step_id;

        const result = await applyEdits(
          [{ type: "removenode", id: resolvedId, graphId: "" }],
          `Remove step: ${resolvedId}`
        );

        if (!result.success) {
          return {
            success: false,
            error: `Failed to remove step "${step_id}"`,
          };
        }

        return { success: true };
      }
    ),

    // =========================================================================
    // graph_edit_properties
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_EDIT_PROPERTIES,
        title: "Updating graph metadata",
        icon: "edit",
        description:
          "Edit the title, description, and theme of the graph. You can provide one, two, or all parameters.",
        parameters: {
          title: z.string().optional().describe("The new title for the graph"),
          description: z
            .string()
            .optional()
            .describe("The new description for the graph"),
          theme_intent: z
            .string()
            .optional()
            .describe(
              "A description of the theme/vibe to generate for the graph (e.g., 'sunset vibe', 'sleek dark mode')"
            ),
        },
        response: {
          success: z.boolean(),
          error: z
            .string()
            .optional()
            .describe(
              "If an error has occurred, will contain a description of the error"
            ),
        },
      },
      async ({ title, description, theme_intent }) => {
        const result = await applyUpdateGraphProperties(
          title,
          description,
          theme_intent
        );

        if (!result.success) {
          return {
            success: false,
            error: result.error ?? "Failed to update graph properties",
          };
        }

        return { success: true };
      }
    ),

    // =========================================================================
    // upsert_agent_step
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_UPSERT_AGENT_STEP,
        title: "Updating step",
        icon: "edit",
        description:
          "Create or update an agent step. Omit step_id to create a new step; provide step_id to update an existing one.",
        parameters: {
          step_id: z
            .string()
            .optional()
            .describe(
              "The handle of an existing step to update (e.g. node-1). Omit to create a new step."
            ),
          title: z.string().describe("A descriptive title for the step"),
          prompt: z.string().describe(PROMPT_DESCRIPTION),
        },
        response: {
          step_id: z
            .string()
            .describe("The handle of the created or updated step")
            .optional(),
          error: z
            .string()
            .optional()
            .describe(
              "If an error has occurred, will contain a description of the error"
            ),
        },
      },
      async ({ step_id, title, prompt }) => {
        const { promptContent, ports } = await resolvePromptAndPorts(
          prompt,
          translator
        );

        let stepId: string;

        if (step_id) {
          const resolved = await resolveAndValidateNode(step_id, translator);
          if ("error" in resolved) {
            return { error: resolved.error };
          }
          const { resolvedId } = resolved;

          stepId = resolvedId;
          await applyUpdateNode(
            stepId,
            "",
            {
              config$prompt: promptContent as unknown as Record<
                string,
                unknown
              >,
            },
            { title },
            ports
          );
        } else {
          stepId = globalThis.crypto.randomUUID();
          const node: NodeDescriptor = {
            id: stepId,
            type: GENERATE_COMPONENT_URL,
            metadata: { title },
            configuration: {
              "generation-mode": "agent",
              config$prompt: promptContent as unknown as NodeValue,
            },
          };

          await applyEdits(
            [{ type: "addnode", graphId: "", node }],
            `Add step: ${title}`
          );

          if (ports.length > 0) {
            await applyUpdateNode(
              stepId,
              "",
              {
                config$prompt: promptContent as unknown as Record<
                  string,
                  unknown
                >,
              },
              null,
              ports
            );
          }
        }

        return reLayoutAndReturnHandle(stepId, translator);
      }
    ),

    // =========================================================================
    // upsert_legacy_step
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_UPSERT_LEGACY_STEP,
        title: "Updating legacy step",
        icon: "edit",
        description:
          "Create or update a legacy step (User Input, Output, or standard Gemini generation steps like Flash, Pro, Nano Banana, Veo, AudioLM, or Lyria).",
        parameters: {
          step_id: z
            .string()
            .optional()
            .describe(
              "The handle of an existing legacy step to update (e.g. node-1). Omit to create a new step."
            ),
          step_type: z
            .enum(VALID_LEGACY_STEP_TYPES)
            .optional()
            .describe(
              "The type of the legacy step. Required to create a step; optional when updating an existing step. Supported types:\n" +
                "- 'user-input': User Input step\n" +
                "- 'output': Output step\n" +
                "- 'text-3-flash': Gemini 3 Flash\n" +
                "- 'text-3-pro': Gemini 3.1 Pro\n" +
                "- 'image': Nano Banana\n" +
                "- 'image-pro': Nano Banana Pro\n" +
                "- 'audio': AudioLM\n" +
                "- 'video': Veo\n" +
                "- 'music': Lyria 2"
            ),
          title: z.string().describe("A descriptive title for the step"),
          prompt: z.string().describe(PROMPT_DESCRIPTION),
          options: z
            .record(z.string(), z.any())
            .optional()
            .describe(
              "Configuration options for the legacy step:\n" +
                "- For 'user-input':\n" +
                "  - 'modality': one of 'Any', 'Audio', 'Image', 'Text', 'Upload File', or 'Video'\n" +
                "  - 'required': boolean (true or false)\n" +
                "- For 'output':\n" +
                "  - 'render_mode': one of 'Manual layout', 'google-doc', 'google-slides', or 'google-sheets'\n" +
                "  - 'doc_title': string (Title of Google Document/Slides/Sheets to save to)\n" +
                "- For generation steps:\n" +
                "  - 'system_instruction': string (System instruction for the model)"
            ),
        },
        response: {
          step_id: z
            .string()
            .describe("The handle of the created or updated step")
            .optional(),
          error: z
            .string()
            .optional()
            .describe(
              "If an error has occurred, will contain a description of the error"
            ),
        },
      },
      async ({ step_id, step_type, title, prompt, options }) => {
        const { promptContent, ports } = await resolvePromptAndPorts(
          prompt,
          translator
        );

        let stepId: string;

        if (step_id) {
          const resolved = await resolveAndValidateNode(step_id, translator);
          if ("error" in resolved) {
            return { error: resolved.error };
          }
          const { resolvedId, node } = resolved;

          // Determine step type for configuration map lookup
          let inferredStepType: string;
          if (step_type) {
            inferredStepType = step_type;
          } else {
            if (node.type === USER_INPUT_COMPONENT_URL) {
              inferredStepType = "user-input";
            } else if (node.type === OUTPUT_COMPONENT_URL) {
              inferredStepType = "output";
            } else if (node.type === GENERATE_COMPONENT_URL) {
              const genMode =
                node.configuration &&
                typeof node.configuration === "object" &&
                "generation-mode" in node.configuration
                  ? (node.configuration["generation-mode"] as string)
                  : undefined;
              inferredStepType = genMode || "text-3-flash";
            } else {
              inferredStepType = "text-3-flash";
            }
          }

          const spec = buildNodeSpec(
            inferredStepType,
            promptContent as unknown
          );

          const finalConfig = { ...spec.configuration };
          const optionMap = LEGACY_OPTION_MAP[inferredStepType];
          if (optionMap && options) {
            for (const [optKey, optVal] of Object.entries(options)) {
              const targetKey =
                optionMap[optKey] || optionMap[optKey.toLowerCase()];
              if (targetKey) {
                finalConfig[targetKey] = optVal;
              } else {
                finalConfig[optKey] = optVal;
              }
            }
          }

          stepId = resolvedId;
          await applyUpdateNode(stepId, "", finalConfig, { title }, ports);
        } else {
          if (!step_type) {
            return {
              error: "step_type is required to create a new legacy step",
            };
          }

          stepId = globalThis.crypto.randomUUID();
          const spec = buildNodeSpec(step_type, promptContent as unknown);

          const finalConfig = { ...spec.configuration };
          const optionMap = LEGACY_OPTION_MAP[step_type];
          if (optionMap && options) {
            for (const [optKey, optVal] of Object.entries(options)) {
              const targetKey =
                optionMap[optKey] || optionMap[optKey.toLowerCase()];
              if (targetKey) {
                finalConfig[targetKey] = optVal;
              } else {
                finalConfig[optKey] = optVal;
              }
            }
          }

          const node: NodeDescriptor = {
            id: stepId,
            type: spec.type,
            metadata: { title },
            configuration: finalConfig as unknown as NodeConfiguration,
          };

          await applyEdits(
            [{ type: "addnode", graphId: "", node }],
            `Add legacy step: ${title}`
          );

          if (ports.length > 0) {
            await applyUpdateNode(stepId, "", finalConfig, null, ports);
          }
        }

        return reLayoutAndReturnHandle(stepId, translator);
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
  sink: AgentEventSink,
  translator: EditingAgentPidginTranslator
): FunctionGroup {
  return {
    ...mapDefinitions(defineGraphEditingFunctions(sink, translator)),
    instruction: buildInstruction(),
  };
}
