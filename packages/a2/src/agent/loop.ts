/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  FunctionResponseCapabilityPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import gemini, {
  FunctionDeclaration,
  GeminiAPIOutputs,
  GeminiInputs,
} from "../a2/gemini";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";
import { llm } from "../a2/utils";
import { err, ok } from "@breadboard-ai/utils";
import { initializeSystemFunctions } from "./functions/system";
import { FunctionDefinition } from "./function-definition";

export { Loop };

const AGENT_MODEL = "gemini-flash-latest";

const systemInstruction = llm`You are an AI agent. Your job is to fulfill the 
objective, specified at the start of the conversation context.

You are linked with other AI agents via hyperlinks. The <a href="url">title</a>
syntax points at another agent. If the objective calls for it, you can transfer
control to this agent. To transfer control, use the url of the agent in the 
"href" parameter when calling "system_objective_fulfilled" or  
"system_failed_to_fulfill_objective" function. As a result, the outcomes and the
intermediate files will be transferred to that agent.

First, examine the problem in front of you and systematically break it down into
tasks.

Can the objective be fulfilled? Do you have all the necessary tools? Is there
missing data? Can it be requested from the user. Answer this question 
thoroughly and methodically. Do not make any assumptions.

If there aren't tools available to fulfill the objective, admit failure, but
make sure to explain to the user why the objective is impossible to fulfill
and offer suggestions on what additionaltools might make the problem tractable.

Otherwise, go on.

Create a dependency tree for the tasks. Which tasks can be executed 
concurrently and which ones must be executed serially?

When faced with the choice of serial or concurrent execution, choose 
concurrency to save precious time.

Finally, formulate the precise plan for  will reseult in
fulfilling the objective. Outline this plan on a scratchpad, so that it's clear
to you how to execute it.

Now start to execute the plan. For concurrent tasks, make sure to generate 
multiple funciton calls at the same time. 

After each task, examine: is the plan still good? Did the results of the tasks
affect the outcome? If not, keep going. Otherwise, reexamine the plan and
adjust it accordingly.
`.asContent();

/**
 * The main agent loop
 */
class Loop {
  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleFactoryArgs
  ) {}

  async run(objective: LLMContent) {
    const contents: LLMContent[] = [objective];
    let terminateLoop = false;
    const systemFunctions = initializeSystemFunctions({
      terminate: () => {
        terminateLoop = true;
      },
    });
    const functions = new Map<string, FunctionDefinition>(
      systemFunctions.map((item) => [item.name!, item])
    );
    const functionDeclarations = systemFunctions.map(
      ({ handler: _handler, ...rest }) => rest as FunctionDeclaration
    );
    while (!terminateLoop) {
      const inputs: GeminiInputs = {
        model: AGENT_MODEL,
        body: {
          contents,
          generationConfig: {
            thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
          },
          systemInstruction,
          toolConfig: {
            functionCallingConfig: { mode: "ANY" },
          },
          tools: [{ functionDeclarations }],
        },
      };
      const generated = (await gemini(
        inputs,
        this.caps,
        this.moduleArgs
      )) as Outcome<GeminiAPIOutputs>;
      if (!ok(generated)) return generated;
      const content = generated.candidates?.at(0)?.content;
      if (!content) {
        return err(`Agent unable to proceed: no content in Gemini response`);
      }
      contents.push(content);
      const parts = content.parts || [];
      for (const part of parts) {
        if (part.thought) {
          if ("text" in part) {
            console.log("THOUGHT", part.text);
          } else {
            console.log("INVALID THOUGHT", part);
          }
        }
        if ("functionCall" in part) {
          const { functionCall } = part;
          const { name, args } = functionCall;
          const fn = functions.get(name!);
          if (!fn || !fn.handler) {
            console.error(`Unknown function`, name);
            return err(`Unknown function "${name}"`);
          }
          console.log("CALLING FUNCTION", name);
          const response = await fn.handler(args as Record<string, string>);
          const functionResponse: FunctionResponseCapabilityPart["functionResponse"] =
            {
              name,
              response,
            };
          contents.push({ parts: [{ functionResponse }] });
        }
      }
    }
  }
}
