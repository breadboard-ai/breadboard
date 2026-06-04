/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Asset,
  AssetMetadata,
  AssetType,
  EditSpec,
  NodeConfiguration,
  NodeDescriptor,
  NodeMetadata,
  NodeValue,
} from "@breadboard-ai/types";
import z from "zod";
import type { InPort } from "../../../ui/transforms/autowire-in-ports.js";
import { segments } from "./instructions/generated.js";
import { A2_TOOLS } from "../../a2-registry.js";
import type { AgentEventSink } from "../agent-event-sink.js";
import { defineFunction, mapDefinitions } from "../function-definition.js";
import type { FunctionGroup } from "../types.js";
import { EditingAgentPidginTranslator } from "./editing-agent-pidgin-translator.js";
import { graphOverviewYaml } from "./graph-overview.js";
import {
  GENERATE_COMPONENT_URL,
  USER_INPUT_COMPONENT_URL,
  OUTPUT_COMPONENT_URL,
  LEGACY_OPTION_MAP,
} from "./constants.js";
import type { ApplyEditsResponse } from "./types.js";
import { bind } from "../../../sca/actions/graph/graph-actions.js";
import { readGraph } from "./read-graph.js";

export { getGraphEditingFunctionGroup };

// =============================================================================
// Constants
// =============================================================================

const GRAPH_GET_OVERVIEW = "graph_get_overview";
const GRAPH_REMOVE_STEP = "graph_remove_step";
const GRAPH_REMOVE_ASSET = "graph_remove_asset";
const GRAPH_UPSERT_AGENT_STEP = "upsert_agent_step";
const GRAPH_UPSERT_LEGACY_STEP = "upsert_legacy_step";
const GRAPH_EDIT_PROPERTIES = "graph_edit_properties";
const GRAPH_UPDATE_THEME = "graph_update_theme";
const GRAPH_POSITION_ITEMS = "graph_position_items";

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
const TOOL_GLOSSARY = EditingAgentPidginTranslator.getToolGlossary();

const PROMPT_DESCRIPTION = `The prompt for the step, written as plain text with \
optional markup tags to express connections and tool usage:
- <result from="STEP_ID" /> — wire an incoming connection from an existing step. \
STEP_ID must be a valid ID from the most recent snapshot of the graph.
- <tool name="TOOL_NAME" /> — attach a tool to the step. Available tools:
${TOOL_NAMES}
- <file src="ASSET_ID" /> — reference a file asset.
- <a href="URL">TITLE</a> — add a route (navigation link).

Any text outside of these tags is the prompt content.`;

// =============================================================================
// Instruction
// =============================================================================

function buildInstruction(productName = "Opal"): string {
  const raw = segments.join("\n\n");
  return raw
    .replaceAll("{{PRODUCT_NAME_PLURAL}}", productName + "s")
    .replaceAll("{{PRODUCT_NAME}}", productName)
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
   * Applies an updateGraphProperties transform (title/description) via suspend.
   */
  async function applyUpdateGraphProperties(
    title?: string,
    description?: string
  ): Promise<ApplyEditsResponse> {
    return sink.suspend<ApplyEditsResponse>({
      applyEdits: {
        requestId: crypto.randomUUID(),
        label: "Update graph properties",
        transform: {
          kind: "updateGraphProperties",
          title,
          description,
        },
      },
    });
  }

  /**
   * Applies an updateGraphProperties transform (theme) via suspend.
   */
  async function applyUpdateTheme(
    title: string | undefined,
    description: string | undefined,
    themeIntent: string
  ): Promise<ApplyEditsResponse> {
    return sink.suspend<ApplyEditsResponse>({
      applyEdits: {
        requestId: crypto.randomUUID(),
        label: "Update theme",
        transform: {
          kind: "updateTheme",
          title,
          description,
          themeIntent,
        },
      },
    });
  }

  /**
   * Creates a resolver that looks up node and asset titles from the current graph.
   * Reads the graph via suspend to get the current state.
   */
  async function titleResolvers(): Promise<{
    nodeResolver: (nodeId: string) => string | undefined;
    assetResolver: (
      assetRef: string
    ) => { path: string; title: string } | undefined;
  }> {
    const graph = await readGraph(sink);
    return {
      nodeResolver: (nodeId: string) => {
        const node = graph.nodes?.find((n) => n.id === nodeId);
        return node?.metadata?.title;
      },
      assetResolver: (assetRef: string) => {
        if (!graph.assets) return undefined;
        const cleanRef = assetRef.replace(/^\/?assets\//, "");
        if (graph.assets[cleanRef]) {
          return {
            path: cleanRef,
            title: graph.assets[cleanRef].metadata?.title ?? cleanRef,
          };
        }
        for (const [key, asset] of Object.entries(graph.assets)) {
          if (asset.metadata?.title === cleanRef) {
            return { path: key, title: cleanRef };
          }
          const title = asset.metadata?.title;
          if (title && !cleanRef.includes(".")) {
            const dotIndex = title.lastIndexOf(".");
            const baseName =
              dotIndex !== -1 ? title.substring(0, dotIndex) : title;
            if (baseName === cleanRef) {
              return { path: key, title };
            }
          }
        }
        return undefined;
      },
    };
  }

  /**
   * Resolves pidgin prompt markup references into standard configuration data and auto-wire InPorts.
   */
  async function resolvePromptAndPorts(
    prompt: string,
    translator: EditingAgentPidginTranslator
  ) {
    const { nodeResolver, assetResolver } = await titleResolvers();
    const promptContent = translator.fromPidgin(
      prompt,
      nodeResolver,
      assetResolver
    );
    const ports = extractResultPorts(prompt, translator);
    return { promptContent, ports };
  }

  /**
   * Resolves a path or title of an asset to its canonical ID/key in graph.assets,
   * and checks that the asset exists.
   */
  async function resolveAndValidateAsset(
    assetRef: string
  ): Promise<{ error: string } | { resolvedId: string; asset: Asset }> {
    const graph = await readGraph(sink);
    if (!graph.assets) {
      return { error: `No assets in graph to resolve "${assetRef}"` };
    }

    const cleanRef = assetRef.replace(/^\/?assets\//, "");

    if (graph.assets[cleanRef]) {
      return { resolvedId: cleanRef, asset: graph.assets[cleanRef] };
    }

    for (const [key, asset] of Object.entries(graph.assets)) {
      if (asset.metadata?.title === cleanRef) {
        return { resolvedId: key, asset };
      }
      const title = asset.metadata?.title;
      if (title && !cleanRef.includes(".")) {
        const dotIndex = title.lastIndexOf(".");
        const baseName = dotIndex !== -1 ? title.substring(0, dotIndex) : title;
        if (baseName === cleanRef) {
          return { resolvedId: key, asset };
        }
      }
    }

    return { error: `Asset "${assetRef}" not found in graph assets` };
  }

  /**
   * Resolves a step_id handle into the raw NodeDescriptor and ensures its existence.
   */
  async function resolveAndValidateNode(
    step_id: string,
    translator: EditingAgentPidginTranslator
  ): Promise<{ error: string } | { resolvedId: string; node: NodeDescriptor }> {
    const resolvedId = translator.getNodeId(step_id) ?? step_id;
    const graph = await readGraph(sink);
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

  function translateRenderMode(mode: unknown): string {
    if (typeof mode !== "string") return "Manual";
    const m = mode.toLowerCase().trim();
    if (
      m === "auto" ||
      m === "webpage" ||
      m === "webpage with auto-layout" ||
      m === "html" ||
      m === "web application"
    ) {
      return "Auto";
    }
    // NOTE FOR FUTURE AGENTS: Do NOT add support for 'consistent-ui' or 'smart-layout' here.
    // That is an old, deprecated mode hidden behind a feature flag. Keep it zapped.
    if (
      m === "google-doc" ||
      m === "doc" ||
      m === "document" ||
      m === "google doc"
    ) {
      return "google-doc";
    }
    if (
      m === "google-slides" ||
      m === "slides" ||
      m === "google slides" ||
      m === "presentation"
    ) {
      return "google-slides";
    }
    if (
      m === "google-sheets" ||
      m === "sheets" ||
      m === "google sheets" ||
      m === "spreadsheet"
    ) {
      return "google-sheets";
    }
    return "Manual";
  }

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
        const graph = await readGraph(sink);
        const { controller } = bind;
        const overview = graphOverviewYaml(
          graph,
          graph.nodes ?? [],
          graph.edges ?? [],
          translator,
          controller.editor.canvas
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
          step_id: z.string().describe("The id of the step to remove"),
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
    // graph_remove_asset
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_REMOVE_ASSET,
        title: "Removing asset",
        icon: "delete",
        description: "Remove an asset from the graph by its ID.",
        parameters: {
          asset_id: z
            .string()
            .describe(
              "The ID of the asset to remove (e.g. 'asset-XYZ.png' or 'my_image.png')"
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
      async ({ asset_id }) => {
        const resolved = await resolveAndValidateAsset(asset_id);
        if ("error" in resolved) {
          return {
            success: false,
            error: resolved.error,
          };
        }
        const result = await applyEdits(
          [{ type: "removeasset", path: resolved.resolvedId }],
          `Remove asset: ${resolved.resolvedId}`
        );

        if (!result.success) {
          return {
            success: false,
            error: `Failed to remove asset "${asset_id}"`,
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
          "Edit the title and/or description of the graph. Provide one or both parameters.",
        parameters: {
          title: z.string().optional().describe("The new title for the graph"),
          description: z
            .string()
            .optional()
            .describe("The new description for the graph"),
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
      async ({ title, description }) => {
        const result = await applyUpdateGraphProperties(title, description);

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
    // graph_update_theme
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_UPDATE_THEME,
        title: "Updating theme",
        icon: "palette",
        description:
          "Update the visual theme of the graph by describing the desired vibe. Fire-and-forget, completes asynchronously",
        parameters: {
          theme_intent: z
            .string()
            .describe(
              "A description of the theme/vibe to generate for the graph (e.g., 'sunset vibe', 'sleek dark mode')"
            ),
        },
        response: {
          success: z.boolean(),
          message: z
            .string()
            .optional()
            .describe("A status message about the theme update"),
          error: z
            .string()
            .optional()
            .describe(
              "If an error has occurred, will contain a description of the error"
            ),
        },
      },
      async ({ theme_intent }) => {
        // Read the current graph to snapshot title/description — they are
        // significant inputs for the splash-image generator.
        const graph = await readGraph(sink);
        const title = graph.title;
        const description = graph.description;

        // Fire-and-forget: theme generation runs in the background so the
        // agent can continue without waiting for it to complete.
        applyUpdateTheme(title, description, theme_intent).catch(() => {
          // Theme generation failures are silently swallowed here — the
          // agent has already moved on. The consumer-side error handling
          // (e.g., onThemeUpdated callback) is responsible for surfacing
          // issues to the user.
        });

        return {
          success: true,
          title,
          description,
          message:
            "Theme change initiated. It will take about 20–30 seconds to complete. Let the user know that the splash image and theme will come up in a bit",
        };
      }
    ),

    // =========================================================================
    // graph_position_items
    // =========================================================================
    defineFunction(
      {
        name: GRAPH_POSITION_ITEMS,
        title: "Positioning items on canvas",
        icon: "place",
        description:
          "Positions steps or assets on the 2D canvas by providing their coordinates.",
        parameters: {
          items: z
            .array(
              z.object({
                id: z.string().describe("The step id or asset id"),
                x: z.number().describe("The x coordinate on canvas"),
                y: z.number().describe("The y coordinate on canvas"),
              })
            )
            .describe("List of items with their new coordinates"),
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
      async ({ items }) => {
        const graph = await readGraph(sink);
        const edits: EditSpec[] = [];

        for (const item of items) {
          const resolvedId = translator.getNodeId(item.id) ?? item.id;
          const node = graph.nodes?.find((n) => n.id === resolvedId);
          if (node) {
            const existingMetadata = (node.metadata ?? {}) as Record<
              string,
              unknown
            >;
            const existingVisual = (existingMetadata.visual ?? {}) as Record<
              string,
              unknown
            >;
            const metadata: NodeMetadata = {
              ...existingMetadata,
              visual: { ...existingVisual, x: item.x, y: item.y },
            };
            edits.push({
              type: "changemetadata",
              id: resolvedId,
              graphId: "",
              metadata,
            });
          } else {
            const assetRes = await resolveAndValidateAsset(item.id);
            if (!("error" in assetRes)) {
              const asset = assetRes.asset;
              const existingMetadata = (asset.metadata ?? {}) as Record<
                string,
                unknown
              >;
              const existingVisual = (existingMetadata.visual ?? {}) as Record<
                string,
                unknown
              >;
              const metadata: AssetMetadata = {
                title: (existingMetadata.title as string) ?? "",
                type: (existingMetadata.type as AssetType) ?? "file",
                ...existingMetadata,
                visual: { ...existingVisual, x: item.x, y: item.y },
              };
              edits.push({
                type: "changeassetmetadata",
                path: assetRes.resolvedId,
                metadata,
              });
            } else {
              return {
                success: false,
                error: `Item "${item.id}" not found in graph steps or assets`,
              };
            }
          }
        }

        if (edits.length > 0) {
          const result = await applyEdits(
            edits,
            `Position ${edits.length} items`
          );
          if (!result.success) {
            return {
              success: false,
              error: result.error ?? "Failed to position items",
            };
          }
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
              "The id of an existing step to update. Omit to create a new step."
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
        let promptContent;
        let ports;
        try {
          const resolved = await resolvePromptAndPorts(prompt, translator);
          promptContent = resolved.promptContent;
          ports = resolved.ports;
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return {
            error: error || "Failed to resolve prompt",
          };
        }

        let stepId: string;
        let isCreate = false;

        if (step_id) {
          const resolved = await resolveAndValidateNode(step_id, translator);
          if ("error" in resolved) {
            stepId = step_id;
            isCreate = true;
            translator.registerHandle(step_id, step_id);
          } else {
            stepId = resolved.resolvedId;
          }
        } else {
          stepId = globalThis.crypto.randomUUID();
          isCreate = true;
        }

        if (isCreate) {
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
        } else {
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
              "The id of an existing legacy step to update. Omit to create a new step."
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
                "  - 'render_mode': one of 'Auto' (for HTML Webpages and Visual UIs), 'Manual layout', 'google-doc', 'google-slides', or 'google-sheets'\n" +
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
        let promptContent;
        let ports;
        try {
          const resolved = await resolvePromptAndPorts(prompt, translator);
          promptContent = resolved.promptContent;
          ports = resolved.ports;
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return {
            error: error || "Failed to resolve prompt",
          };
        }

        let stepId: string;
        let isCreate = false;
        let inferredStepType: string;

        if (step_id) {
          const resolved = await resolveAndValidateNode(step_id, translator);
          if ("error" in resolved) {
            stepId = step_id;
            isCreate = true;
            translator.registerHandle(step_id, step_id);
            inferredStepType = step_type || "text-3-flash";
          } else {
            stepId = resolved.resolvedId;
            const { node } = resolved;
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
          }
        } else {
          stepId = globalThis.crypto.randomUUID();
          isCreate = true;
          if (!step_type) {
            return {
              error: "step_type is required to create a new legacy step",
            };
          }
          inferredStepType = step_type;
        }

        const spec = buildNodeSpec(inferredStepType, promptContent as unknown);

        const finalConfig = { ...spec.configuration };
        const optionMap = LEGACY_OPTION_MAP[inferredStepType];
        if (optionMap && options) {
          for (const [optKey, optVal] of Object.entries(options)) {
            const targetKey =
              optionMap[optKey] || optionMap[optKey.toLowerCase()];
            if (targetKey) {
              if (targetKey === "p-render-mode") {
                finalConfig[targetKey] = translateRenderMode(optVal);
              } else {
                finalConfig[targetKey] = optVal;
              }
            } else {
              finalConfig[optKey] = optVal;
            }
          }
        }

        if (isCreate) {
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
        } else {
          await applyUpdateNode(stepId, "", finalConfig, { title }, ports);
        }

        return reLayoutAndReturnHandle(stepId, translator);
      }
    ),
  ];
}

// =============================================================================
// Helpers
// =============================================================================

const RESULT_FROM_REGEX = /<result\s+from\s*=\s*"([^"]*)"\s*\/>/g;

/**
 * Extract result ports from pidgin text. Each <result from="STEP_ID" /> tag
 * becomes an InPort for auto-wiring.
 */
function extractResultPorts(
  pidginText: string,
  translator: EditingAgentPidginTranslator
): InPort[] {
  const ports: InPort[] = [];
  const seen = new Set<string>();

  for (const match of pidginText.matchAll(RESULT_FROM_REGEX)) {
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
  translator: EditingAgentPidginTranslator,
  productName = "Opal"
): FunctionGroup {
  return {
    ...mapDefinitions(defineGraphEditingFunctions(sink, translator)),
    instruction: buildInstruction(productName),
  };
}
