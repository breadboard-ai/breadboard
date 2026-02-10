/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeDescriptor } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import z from "zod";
import { tr } from "../../a2/utils.js";
import {
  defineFunction,
  defineFunctionLoose,
  FunctionDefinition,
  mapDefinitions,
} from "../function-definition.js";
import { FunctionGroup } from "../types.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import {
  conformGeminiBody,
  GeminiBody,
  streamGenerateContent,
} from "../../a2/gemini.js";
import { getCurrentStepState } from "../progress-work-item.js";

export { getOnDemandUIFunctionGroup };

const GENERATE_NEW_UI = "generate_new_ui";

const UI_NODE_TYPE = "embed://a2/ui.bgl.json#module:main";

const UI_GEN_MODEL = "gemini-3-flash-preview";

const UI_GEN_SYSTEM_INSTRUCTION = `You are an expert frontend UI code generator. Your task is to create a JavaScript function that accepts a specific input data schema, renders a React-based template to the html body fulfilling the specified UI intent, and calls a completion callback with a single argument containing the specified data once certain conditions are met.

Important notes about generated code:
* The code generated must be a single HTML file, fully self-contained, with the exception of being allowed to import the following scripts:
\`\`\`
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
\`\`\`
* There should be exactly one function added to the window called \`renderUI(input, callback)\` which should render the inputs (you may make the type accepted for input and the type of the arguments for the callback be whatever necessary to complete the intent)
* Avoid using JSX syntax, only use pure JS (e.g. call React.createElement or similar)

Important notes about how to respond: Please respond with exactly four fenced code blocks:
1. The HTML as described above
2. An OpenAPI 3.0-compatible JSON Schema for the type of the input argument to the function
3. An OpenAPI 3.0-compatible JSON Schema for the type of the argument to the callback (always place responses as named fields in an object)
4. A short identifier (<=5 words) to name this UI in snake case (e.g. "image_carousel_with_confirm")
5. A dummy input payload to use to render a preview of the generated UI.
`;

const instruction = tr`

## On-Demand UI

If you would like to interact with the user (either display content or other UI, or request input from the user) or both, FIRST check whether there is an existing "present_ui_" function that you can call
that matches your intent. If there is, you should call that function instead of generating a new UI, as this is a slow and costly operation for the user.

If a suitable UI function does not yet exist, call the "${GENERATE_NEW_UI}" to generate a new screen
to show the user. Once generated, you can call this new function to display the UI to the user.

`;

/**
 * Reads the configuration of a UI node from its descriptor.
 */
function readUINodeConfig(node: NodeDescriptor): {
  htmlCode: string;
  inputSchema: Record<string, unknown>;
  callbackSchema: Record<string, unknown>;
  functionName: string;
} | null {
  const config = node.configuration;
  if (!config) return null;
  const htmlCode = config["html-code"];
  const inputSchemaStr = config["input-schema"];
  const callbackSchemaStr = config["callback-schema"];
  const functionName = config["function-name"];
  if (
    typeof htmlCode !== "string" ||
    typeof inputSchemaStr !== "string" ||
    typeof callbackSchemaStr !== "string" ||
    typeof functionName !== "string"
  ) {
    return null;
  }
  try {
    return {
      htmlCode,
      inputSchema: JSON.parse(inputSchemaStr),
      callbackSchema: JSON.parse(callbackSchemaStr),
      functionName,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a present_ui_* FunctionDefinition for a given UI config.
 */
function createPresentUIFunction(
  htmlCode: string,
  inputSchema: Record<string, unknown>,
  callbackSchema: Record<string, unknown>,
  functionName: string,
  description: string,
  moduleArgs: A2ModuleArgs
): FunctionDefinition {
  return defineFunctionLoose(
    {
      name: `present_ui_${functionName}`,
      description,
      icon: "web",
      title: `present_ui_${functionName}`,
      parametersJsonSchema: inputSchema,
      responseJsonSchema: callbackSchema,
    },
    async (args) => {
      console.log(`present_ui_${functionName} called with:`, args);
      const { appScreen } = getCurrentStepState(moduleArgs);
      const callbackResult = await new Promise<Record<string, unknown>>(
        (resolve) => {
          if (appScreen) {
            const outputId = crypto.randomUUID();
            appScreen.outputs.set(outputId, {
              schema: undefined,
              output: {
                context: [
                  {
                    parts: [
                      {
                        inlineData: {
                          mimeType: "text/html",
                          data: htmlCode,
                        },
                      },
                    ],
                  },
                ],
              },
              onDemandUI: {
                input: args as Record<string, unknown>,
                callback: resolve,
              },
            });
            appScreen.status = "interactive";
          }
        }
      );
      if (appScreen) {
        appScreen.status = "processing";
      }
      return callbackResult;
    }
  );
}

/**
 * Adds a new UI node to the current graph and connects it to the current step.
 * Uses the EditableGraph API for proper persistence and history tracking.
 */
async function addUINodeToGraph(
  moduleArgs: A2ModuleArgs,
  htmlCode: string,
  inputSchema: Record<string, unknown>,
  callbackSchema: Record<string, unknown>,
  functionName: string,
  dummyInput: Record<string, unknown>
): Promise<void> {
  const graph = moduleArgs.context.currentGraph;
  const graphStore = moduleArgs.context.graphStore;
  const currentStepId = moduleArgs.context.currentStep?.id;
  if (!graph || !graphStore || !currentStepId) {
    console.warn(
      "[on-demand-ui] Cannot add UI node: no graph, graphStore, or currentStep"
    );
    return;
  }

  const editableGraph = graphStore.editByDescriptor(graph);
  if (!editableGraph) {
    console.warn(
      "[on-demand-ui] Cannot add UI node: editByDescriptor returned undefined"
    );
    return;
  }

  const nodeId = `ui-${functionName}-${crypto.randomUUID().slice(0, 8)}`;

  // Compute position near the current step node
  let x = 0;
  let y = 0;
  const currentNode = graph.nodes?.find((n) => n.id === currentStepId);
  if (currentNode?.metadata?.visual) {
    const visual = currentNode.metadata.visual as { x?: number; y?: number };
    x = (visual.x ?? 0) - 300;
    y = visual.y ?? 0;
  }

  const node: NodeDescriptor = {
    id: nodeId,
    type: UI_NODE_TYPE,
    configuration: {
      "html-code": htmlCode,
      "input-schema": JSON.stringify(inputSchema),
      "callback-schema": JSON.stringify(callbackSchema),
      "function-name": functionName,
      "dummy-input": JSON.stringify(dummyInput),
    },
    metadata: {
      title: `UI: ${functionName}`,
      visual: { x, y },
    },
  };

  const result = await editableGraph.edit(
    [
      {
        type: "addnode",
        node,
        graphId: "",
      },
      {
        type: "addedge",
        edge: {
          from: nodeId,
          to: currentStepId,
          out: "context",
          in: "context",
        },
        graphId: "",
      },
    ],
    `Add UI node: ${functionName}`
  );

  if (result.success) {
    console.log(
      `[on-demand-ui] Added UI node "${nodeId}" connected to "${currentStepId}"`
    );
  } else {
    console.warn(
      `[on-demand-ui] Failed to add UI node:`,
      "error" in result ? result.error : "unknown error"
    );
  }
}

/**
 * Finds all UI nodes connected to the current step and returns their
 * reified present_ui_* function definitions.
 */
function reifyConnectedUIFunctions(
  moduleArgs: A2ModuleArgs
): FunctionDefinition[] {
  const graph = moduleArgs.context.currentGraph;
  const currentStepId = moduleArgs.context.currentStep?.id;
  if (!graph || !currentStepId) return [];

  const edges = graph.edges ?? [];
  const nodes = graph.nodes ?? [];

  // Find UI nodes that have edges pointing to the current step
  const connectedUINodeIds = edges
    .filter((e) => e.to === currentStepId)
    .map((e) => e.from);

  const definitions: FunctionDefinition[] = [];
  for (const nodeId of connectedUINodeIds) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== UI_NODE_TYPE) continue;

    const config = readUINodeConfig(node);
    if (!config) continue;

    definitions.push(
      createPresentUIFunction(
        config.htmlCode,
        config.inputSchema,
        config.callbackSchema,
        config.functionName,
        `Present the ${config.functionName} UI`,
        moduleArgs
      )
    );
  }

  return definitions;
}

function getOnDemandUIFunctionGroup(
  moduleArgs: A2ModuleArgs,
  registerTool: (definition: FunctionDefinition) => void
): FunctionGroup {
  // Phase 3: Reify existing UI functions from connected UI nodes.
  const reifiedDefs = reifyConnectedUIFunctions(moduleArgs);
  const reifiedMapped =
    reifiedDefs.length > 0
      ? mapDefinitions(reifiedDefs)
      : { declarations: [], definitions: [] };

  const coreGroup = mapDefinitions([
    defineFunction(
      {
        name: GENERATE_NEW_UI,
        title: "Present New UI",
        icon: "dashboard",
        description: tr`Generates a new reusable HTML-based UI from a natural language intent description.`,
        parameters: {
          ui_intent: z
            .string()
            .describe(
              `A natural language description of the UI to generate, including what data it should accept, what it should display, and what data it should produce via callback. Think about what data is likely to be specific to the user's current context and should be provided as input to the UI, vs. what data is likely to be more general can be included in the generated UI directly, and make that clear in description of the input data schema.`
            ),
        },
        response: {
          new_function_name: z
            .string()
            .describe(
              `The name of the new function you should call to render this UI.`
            )
            .optional(),
        },
      },
      async ({ ui_intent }) => {
        const body: GeminiBody = {
          contents: [
            {
              role: "user",
              parts: [{ text: ui_intent }],
            },
          ],
          systemInstruction: {
            role: "user",
            parts: [{ text: UI_GEN_SYSTEM_INSTRUCTION }],
          },
          generationConfig: {
            temperature: 1,
            topP: 1,
          },
        };

        const conformedBody = await conformGeminiBody(moduleArgs, body);
        if (!ok(conformedBody)) {
          return { error: conformedBody.$error };
        }

        const generated = await streamGenerateContent(
          UI_GEN_MODEL,
          conformedBody,
          moduleArgs
        );
        if (!ok(generated)) {
          return { error: generated.$error };
        }

        // Collect all text from the streamed response
        let fullText = "";
        for await (const chunk of generated) {
          const content = chunk.candidates?.at(0)?.content;
          if (!content?.parts) continue;
          for (const part of content.parts) {
            if ("text" in part && !part.thought) {
              fullText += part.text;
            }
          }
        }
        // Parse the four fenced code blocks from the response
        const codeBlocks = extractCodeBlocks(fullText);
        const htmlCode = codeBlocks[0];
        const inputSchema = JSON.parse(codeBlocks[1] ?? "{}");
        const callbackSchema = JSON.parse(codeBlocks[2] ?? "{}");
        const functionName = codeBlocks[3];
        const dummyInput = JSON.parse(codeBlocks[4] ?? "{}");

        console.log("=========== ON DEMAND UI GENERATED ===========");
        console.log("Generated HTML:", htmlCode);
        console.log("Input Schema:", inputSchema);
        console.log("Callback Schema:", callbackSchema);
        console.log("Function Name:", functionName);
        console.log("Dummy Input:", dummyInput);

        if (codeBlocks.length < 5) {
          return {
            error: `Expected 5 fenced code blocks but found ${codeBlocks.length}`,
          };
        }

        // Register the new present_ui_* function dynamically
        const newFunctionDef = createPresentUIFunction(
          htmlCode,
          inputSchema,
          callbackSchema,
          functionName,
          ui_intent,
          moduleArgs
        );
        registerTool(newFunctionDef);

        // Phase 2: Auto-create a UI node in the graph
        await addUINodeToGraph(
          moduleArgs,
          htmlCode,
          inputSchema,
          callbackSchema,
          functionName,
          dummyInput
        );

        return {
          new_function_name: functionName,
        };
      }
    ),
  ]);

  return {
    declarations: [...coreGroup.declarations, ...reifiedMapped.declarations],
    definitions: [...coreGroup.definitions, ...reifiedMapped.definitions],
    instruction,
  };
}

/**
 * Extracts content from fenced code blocks (```...```) in a string.
 */
function extractCodeBlocks(text: string): string[] {
  const regex = /```(?:\w*)\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}
