/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import {
  Content,
  FunctionCallingConfigMode,
  FunctionResponse,
  GoogleGenAI,
} from "@google/genai";
import { env } from "process";
import { systemFunctions, terminateLoop } from "./functions/system";
import { FunctionDefinition } from "./define-function";
import { videoFunctions } from "./functions/video";
import { generateFunctions } from "./functions/generate";
import { evalSet } from "./eval-set";
import { writeFile } from "fs/promises";

config();

const objective = evalSet.get("chat");

const systemInstruction = `You are an AI agent. Your job is to fulfill the 
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
`;

const functionDeclarations = [
  ...systemFunctions,
  ...generateFunctions,
  ...videoFunctions,
];

const functions = new Map<string, FunctionDefinition>(
  functionDeclarations.map((item) => [item.name!, item])
);

const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const contents: Content[] = [
  {
    parts: [
      {
        text: `<objective>
${objective}
</objective>`,
      },
    ],
  },
];

outerLoop: while (!terminateLoop) {
  await writeFile("out.log", JSON.stringify(functionDeclarations));
  const generated = await gemini.models.generateContent({
    model: "gemini-flash-latest",
    contents,
    config: {
      thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
      systemInstruction,
      toolConfig: {
        functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
      },
      tools: [{ functionDeclarations }],
    },
  });
  // for await (const chunk of generated) {
  const parts = generated.candidates?.at(0)?.content?.parts || [];
  for (const part of parts) {
    if (part.thought) {
      console.log("THOUGHT", part.text);
    }
  }
  const { functionCalls } = generated;
  contents.push(generated.candidates!.at(0)!.content!);
  if (functionCalls) {
    for (const functionCall of functionCalls) {
      const { name, args } = functionCall;
      const fn = functions.get(name!);
      if (!fn || !fn.handler) {
        console.error(`Unknown function`, name);
        break outerLoop;
      }
      const response = await fn.handler(args as Record<string, string>);
      const functionResponse: FunctionResponse = {
        name,
        response,
      };
      contents.push({ parts: [{ functionResponse }] });
    }
  }
  // }
}
