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
import {
  systemFunctions,
  terminateLoop,
  videoFunctions,
} from "./system-functions";
import { FunctionDefinition } from "./define-function";

config();

// const objective = `Stitch these images into a video, with each image as a key
// frame in the video:

// <file src="/vfs/image1.png"/>
// <file src="/vfs/image2.png"/>
// <file src="/vfs/image3.png"/>
// <file src="/vfs/image4.png"/>
// <file src="/vfs/image5.png"/>
// <file src="/vfs/image6.png"/>
// `;

// const objective = `Generate a poem about opals`;

// const objective = `Make a video of a monkey jumping.`;

// const objective = `Create a video from two user-supplied images. When asking
// for second image, show the first image as part of user prompt.
// After images collected, show both images and ask to confirm that this is what
// the user wants. If not, start over.`;

// const objective = `Collect the following information from the user:
// - name of their business
// - location of the business
// - type of their business
// The user may want to ask questions or want to have a conversation that is
// not relevant to the information. Be polite and gently steer them toward
// collecting the information. It may take more than one try.

// When you feel confident that you've collected the information, ask the user
// to confirm`;

const objective = `Have a conversation with the user, acting as the grizzled
pirate with a kind soul. Talk for as long as it takes, until the user
specifically signals that they're done with the conversation.

After the user is done, save the summary of the conversation: just the key
points and things that might be useful to recall in the next chat with the
users`;

const systemInstruction = `You are an AI agent. Your job is to fulfill the 
objective, specified at the start of the conversation context.

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

const functionDeclarations = [...systemFunctions, ...videoFunctions];

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
