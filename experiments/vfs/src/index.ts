/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import {
  Content,
  FunctionCallingConfigMode,
  FunctionDeclaration,
  FunctionResponse,
  GoogleGenAI,
  Type,
} from "@google/genai";
import { env } from "process";

config();

const objective = `
<objective>
Stitch these images into a video, with each image as a key frame in the video:

<file src="/vfs/image1.png"/>
<file src="/vfs/image2.png"/>
<file src="/vfs/image3.png"/>
<file src="/vfs/image4.png"/>
<file src="/vfs/image5.png"/>
<file src="/vfs/image6.png"/>
</objective>
`;

const systemInstruction = `You are an AI agent. Your job is to fulfill the 
objective, specified at the start of the conversation context.

First, examine the problem in front of you and systematically break it down into
tasks.
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

const objectiveFulfilledFunction: FunctionDeclaration = {
  name: "objective_fulfilled",
  description: `Inidicates completion of the overall objective. 
Call only when the specified objective is entirely fulfilled`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      user_message: {
        type: Type.STRING,
        description: `Text to display to the user upon fulfillment 
of the objective. Use the <file src="path" /> syntax to embed the outcome 
in the text`,
      },
      objective_outcomes: {
        type: Type.ARRAY,
        description: `The array of outcomes that were requested in 
the objective.`,
        items: {
          type: Type.STRING,
        },
      },
      intermediate_outcomes: {
        type: Type.ARRAY,
        description: `Any intermediate outcomes that were produced as a 
result of fulfilling the objective `,
        items: {
          type: Type.STRING,
        },
      },
    },
    required: ["user_message", "objective_outcomes", "intermediate_outcomes"],
  },
};

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "video_from_frames",
    description:
      "Generates a video given two frames: starting frame and ending frame",
    parameters: {
      type: Type.OBJECT,
      properties: {
        startFrame: {
          type: Type.STRING,
          description:
            "The starting frame of the video, specified as a VFS path",
        },
        endFrame: {
          type: Type.STRING,
          description: "The end frame of the video, provided as a VFS path",
        },
      },
      required: ["startFrame", "endFrame"],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        video: {
          type: Type.STRING,
          description: "The generated video, specified as a VFS path",
        },
      },
      required: ["video"],
    },
  },
  {
    name: "concatenate_videos",
    description: "Contatenates two or more videos together",
    parameters: {
      type: Type.OBJECT,
      properties: {
        videos: {
          type: Type.ARRAY,
          description: `The array of the videos to concatenate. 
The videos will be concatented in the order they are provided`,
          items: {
            type: Type.STRING,
          },
        },
      },
      required: ["videos"],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        video: {
          type: Type.STRING,
          description: "The resulting video, provided as a VFS path",
        },
      },
      required: ["video"],
    },
  },
  objectiveFulfilledFunction,
];

type Fn = (args: Record<string, string>) => Record<string, string>;

let videoCount = 0;
let objectiveFulfilled = false;

const functions = new Map<string, Fn>([
  [
    "video_from_frames",
    ({ startFrame, endFrame }) => {
      console.log("Generating video from", startFrame, "to", endFrame);
      return { video: `/vfs/video${++videoCount}.mp4` };
    },
  ],
  [
    "concatenate_videos",
    ({ videos }) => {
      console.log("Concatenating videos", videos);
      return { video: `/vfs/video${++videoCount}.mp4` };
    },
  ],
  [
    "objective_fulfilled",
    ({ user_message, objective_outcomes, intermediate_outcomes }) => {
      console.log("Objective fulfilled");
      console.log("User message", user_message);
      console.log("Objective outcomes", objective_outcomes);
      console.log("Intermediate outcomes", intermediate_outcomes);
      objectiveFulfilled = true;
      return {};
    },
  ],
]);

const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const contents: Content[] = [
  {
    parts: [{ text: objective }],
  },
];

outerLoop: while (!objectiveFulfilled) {
  const generated = await gemini.models.generateContent({
    model: "gemini-flash-latest",
    contents,
    config: {
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: -1,
      },
      systemInstruction,
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
        },
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
  const { text, functionCalls } = generated;
  console.log("TEXT", text);
  console.log("CALLS", functionCalls);
  contents.push(generated.candidates!.at(0)!.content!);
  if (functionCalls) {
    for (const functionCall of functionCalls) {
      const { name, args } = functionCall;
      const fn = functions.get(name!);
      if (!fn) {
        console.error(`Unknown function`, name);
        break outerLoop;
      }
      const response = fn(args as Record<string, string>);
      const functionResponse: FunctionResponse = {
        name,
        response,
      };
      contents.push({ parts: [{ functionResponse }] });
    }
  }
  // }
}
