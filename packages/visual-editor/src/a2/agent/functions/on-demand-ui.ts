/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
2. A zod JSON schema for the type of the input argument to the function
3. A zod JSON schema for the type of the argument to the callback
4. A short identifier (<=5 words) to name this UI in snake case (e.g. "image_carousel_with_confirm")
`;

const instruction = tr`

## On-Demand UI

If you would like to interact with the user (either display content or other UI, or request input from the user) or both, FIRST check whether there is an existing "present_ui_" function that you can call
that matches your intent. If there is, you should call that function instead of generating a new UI, as this is a slow and costly operation for the user.

If a suitable UI function does not yet exist, call the "${GENERATE_NEW_UI}" to generate a new screen
to show the user. Once generated, you can call this new function to display the UI to the user.

`;

function getOnDemandUIFunctionGroup(
  moduleArgs: A2ModuleArgs,
  registerTool: (definition: FunctionDefinition) => void
): FunctionGroup {
  return {
    ...mapDefinitions([
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

          // Parse the three fenced code blocks from the response
          const codeBlocks = extractCodeBlocks(fullText);
          if (codeBlocks.length < 4) {
            return {
              error: `Expected 4 fenced code blocks but found ${codeBlocks.length}`,
            };
          }

          const htmlCode = codeBlocks[0];
          const inputSchema = JSON.parse(codeBlocks[1]);
          const callbackSchema = JSON.parse(codeBlocks[2]);
          const functionName = codeBlocks[3];

          console.log("=========== ON DEMAND UI GENERATED ===========");
          console.log("Generated HTML:", htmlCode);
          console.log("Input Schema:", inputSchema);
          console.log("Callback Schema:", callbackSchema);
          console.log("Function Name:", functionName);

          // Register the new present_ui_* function dynamically
          const newFunctionDef = defineFunctionLoose(
            {
              name: `present_ui_${functionName}`,
              description: ui_intent,
              icon: "web",
              title: `present_ui_${functionName}`,
              parametersJsonSchema: inputSchema,
              responseJsonSchema: callbackSchema,
            },
            async (args) => {
              console.log(`present_ui_${functionName} called with:`, args);
              const { appScreen } = getCurrentStepState(moduleArgs);
              // Pause execution until the callback resolves.
              const callbackResult = await new Promise<Record<string, unknown>>(
                (resolve) => {
                  if (appScreen) {
                    const outputId = crypto.randomUUID();
                    // Set output as LLMContentArray with text/html so
                    // getHTMLOutput() picks it up for bb-app-sandbox.
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
          registerTool(newFunctionDef);

          return {
            new_function_name: functionName,
          };
        }
      ),
    ]),
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
