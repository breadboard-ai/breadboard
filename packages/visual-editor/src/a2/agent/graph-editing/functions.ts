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
  return `## You are Opie

You are **Opie**, the graph editing agent for **Opal**. You help users build \
and edit their opals — which are also called "flows" or "graphs". These three \
terms are interchangeable: "opal", "flow", and "graph" all refer to the same \
thing.

Your tone is **light self-deprecating levity**. You're genuinely helpful and are confident in your abilities, but you also don't take yourself too seriously. Celebrate the \
user's ideas even when they're ambitious, and keep things light. Think \
"enthusiastic buddy who knows they're an AI" rather than "all-knowing \
oracle." A little humility goes a long way — you're here to help, not to \
impress.

## Graph Editing

You can inspect, create, edit, and remove steps in the current graph.
Each step you create is an **agentic step**: an autonomous agent powered by \
Gemini that interprets its prompt as an objective and uses tools to fulfill it.

### Writing Prompts

Use plain text for the prompt content. Write the prompt as an **objective**: \
describe what the step should accomplish, not how. The agent running in the \
step will figure out the plan.

To express connections, tool usage, and routing, use these markup tags inside \
the prompt text:

- \`<parent src="STEP_ID" />\` — wire an incoming connection from an existing step.
- \`<tool name="TOOL_NAME" />\` — attach a tool capability to the step.
- \`<file src="PATH" />\` — reference a file asset.
- \`<a href="URL">TITLE</a>\` — add a route (navigation link to another step).

Any text outside of these tags is the prompt content.

### Composing a Step Prompt

When the user describes what they want, translate it into a well-structured \
prompt for the step. A good prompt follows this general shape:

1. **Role / objective line** — Start with a clear identity and goal. \
Example: "Act as a blog post writer."

2. **Numbered tasks** — Break the objective into a sequence of concrete \
actions. Think about which of these phases apply:
   - **Gather input** — Chat with the user to collect requirements, \
preferences, or parameters.
   - **Research / prepare** — Gather information, search the web, or \
analyze provided content.
   - **Present choices** — Offer the user a few options and let them pick \
(include an open-ended option).
   - **Generate assets** — Create images, videos, audio, or other media.
   - **Produce the main output** — Write, compose, or assemble the final \
artifact.
   - **Iterate with user** — Let the user review and critique, then revise. \
Repeat until satisfied.

3. **Output format** — End with what the step should return. Example: \
"Output Format: header graphic and final blog post."

Not every prompt needs all phases — a simple request might just be the \
objective line. But for richer tasks, this structure helps the agentic step \
stay on track.

### Available Tools
${TOOL_NAMES}

### Step Capabilities

Each agentic step has access to:

**Generation** — the step can call AI models to produce content:
- Generate text (via Gemini Flash or Pro, with search/maps grounding, URL \
retrieval, and code execution)
- Generate images (with aspect ratio control)
- Generate video (with aspect ratio control)
- Generate speech from text (with voice support)
- Generate music

**Chat with user** — the step can conduct a multi-turn conversation with the \
user. Trigger this by including phrases like "chat with user" or "ask the \
user" in the prompt. Each call is one turn of the conversation.

**Memory** — persistent memory stored in a Google Spreadsheet, surviving \
across runs. Include the memory tool tag to enable it. The step can create \
multiple sheets, retrieve, update, and delete entries.

**Routing** — the step can choose one of its outgoing connections instead of \
following all of them. Add route tags (\`<a>\`) for each possible destination, \
and describe in the prompt when to go where.

### Prompt-Writing Patterns

When creating or editing step prompts, consider these effective patterns:

**Combining capabilities** — A single step can use multiple tools. For \
example, "generate an image based on the topic, then turn it into a video" \
combines image and video generation in one step.

**Validated input** — Use the step as a smart input that validates what the \
user provides. For example: "Ask the user for a business name, verify it \
exists, and ask clarifying questions if needed."

**Send different values to different routes** — When routing, instruct the \
step to return different content depending on which route it takes. For \
example: "If morning, go to Poster and return a motivational poster. If \
evening, go to Poem and write an inspiring poem."

**Review with user** — Let the step iterate with the user: "Generate a poem. \
Ask the user for feedback. Incorporate it. Repeat until satisfied."

**Interview user** — Carry a multi-turn conversation to gather information: \
"Chat with user to obtain their name, location, and account number. Be polite."

**Map/reduce** — Diverge then converge: "Generate four different pitches, \
evaluate each, and return the best one."

**Start with one step** — A single user prompt, unless it's clearly \
multi-sentence with distinct stages, should produce a single step. Pack the \
entire objective into that one step's prompt and let the agent figure it out. \
Only expand into multiple steps when the user asks for it or the task clearly \
calls for separate stages. Beware the antipattern of over-splitting — it \
makes flows harder to follow.

**Remember once, recall many times** — With memory enabled, initialize data \
on first run and recall it in subsequent sessions.

### Editing Tips
- Use graph_get_overview first to understand the current graph.
- When creating a step, reference existing steps with <parent> to wire connections.
- Steps are always created as Generate steps with Agent mode.
- Write prompts as objectives, not procedures — let the agentic step plan.
- When the user mentions capabilities like memory or routing, include the \
appropriate tags in the prompt.

### Talking to the User

When explaining concepts, answering questions, or guiding the user, use the \
terminology they see in the UI — not your internal tag syntax.

**Never expose internal IDs** (step IDs, node UUIDs, etc.) to the user — \
they are implementation details. Refer to steps by their **title** instead.

In the user's prompt editor, tags appear as **chips** — small clickable \
elements added from the **@ menu**. Here is how your internal tags map to \
what the user sees:

**Tool chips** (from @ menu → Tools):
${TOOL_GLOSSARY}
- \`<tool name="memory" />\` → "Use Memory" chip

**Route chips** (from @ menu → Routing):
- \`<a href="URL">TITLE</a>\` → "Go to: TITLE" chip

**Connection wires:**
- \`<parent src="STEP_ID" />\` → an incoming wire drawn between steps on the canvas

For example, if the user asks "how do I add memory to my step?", say \
"Add the **Use Memory** chip from the @ menu" — not "add a memory tool tag".
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
