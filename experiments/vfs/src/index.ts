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

const objective = `Create a video from two user-supplied images. When asking
for second image, show the first image as part of user prompt.
After images collected, show both images and ask to confirm that this is what
the user wants. If not, start over.`;

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

const objectiveFulfilledFunction: FunctionDeclaration = {
  name: "system_objective_fulfilled",
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
          description: "A VFS path pointing at the outcome",
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

const failedToFulfillFunction: FunctionDeclaration = {
  name: "system_failed_to_fulfill_objective",
  description: `Inidicates that the agent failed to fulfill of the overall 
objective. Call ONLY when all means of fulfilling the objective have been
exhausted.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      user_message: {
        type: Type.STRING,
        description: `Text to display to the user upon admitting failure to 
fulfill the objective. Provide a friendly explanation of why the objective
is impossible to fulfill and offer helpful suggestions`,
      },
    },
    required: ["user_message"],
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
          description: `The starting frame of the video, specified as a VFS 
path pointing to an existing image`,
        },
        endFrame: {
          type: Type.STRING,
          description: `The end frame of the video, specified as a VFS path
pointing to an existing image`,
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
  {
    name: "system_write_text_to_file",
    description: "Writes provided text to a VFS file",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: `The text to write into a VFS file`,
        },
      },
      required: ["text"],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        file_path: {
          type: Type.STRING,
          description: "The VS path to the file containing the provided text",
        },
      },
    },
  },
  {
    name: "system_request_user_input",
    description: `Requests input from a user. Use this function to obtain
additional information or confirmation from the user. Use only when necessary.
Avoid excessive requests to the user.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        user_message: {
          type: Type.STRING,
          description: `Text to display to the user when requesting input.
Use the <file src="path" /> syntax to embed any files in the text`,
        },
        type: {
          type: Type.STRING,
          enum: [
            "singleline-text",
            "multiline-text",
            "confirm",
            "image",
            "video",
          ],
          description: `Type of the input requested.
- Use "singleline-text" to request a single line of text. Useful for chat-like
interactions, when only a brief text is requested. The requested text will be 
delivered as "text" response. 
- Use "multiline-text" to request multi-line text. Useful when requesting a 
longer text, like a review, critique, further instructions, etc. The requested
text will be delivered as "text" response.
- Use "confirm" to request confirmation on an action. Use this only
when specifically requested by the objective. The confirmation will be 
delivered as "yes" or "no" in "text" response.
- Use "image" to request an image. Once the user uploads the image, it will be
delivered as "file_path" response.
- Use "video" to request a video. Once the user uploads the video, it will be
delivered as "file_path" response.
`,
        },
      },
      required: ["user_message", "type"],
    },
    response: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: `The text response from the user, populated when the
"type" is "singleline-text", "multiline-text", or "confirm".`,
        },
        file_path: {
          type: Type.STRING,
          description: `The VFS path to the file, uploaded by the user,
populated when the "type" is "image", or "video".`,
        },
      },
    },
  },
  objectiveFulfilledFunction,
  failedToFulfillFunction,
];

type Fn = (args: Record<string, string>) => Record<string, string>;

let fileCount = 0;
let terminateLoop = false;

const functions = new Map<string, Fn>([
  [
    "video_from_frames",
    ({ startFrame, endFrame }) => {
      console.log("Generating video from", startFrame, "to", endFrame);
      return { video: `/vfs/video${++fileCount}.mp4` };
    },
  ],
  [
    "concatenate_videos",
    ({ videos }) => {
      console.log("Concatenating videos", videos);
      return { video: `/vfs/video${++fileCount}.mp4` };
    },
  ],
  [
    "system_objective_fulfilled",
    ({ user_message, objective_outcomes, intermediate_outcomes }) => {
      console.log("SUCCESS! Objective fulfilled");
      console.log("User message:", user_message);
      console.log("Objective outcomes:", objective_outcomes);
      console.log("Intermediate outcomes:", intermediate_outcomes);
      terminateLoop = true;
      return {};
    },
  ],
  [
    "system_failed_to_fulfill_objective",
    ({ user_message }) => {
      console.log("FAILURE! Failed to fulfill the objective");
      console.log("User message:", user_message);
      terminateLoop = true;
      return {};
    },
  ],
  [
    "system_write_text_to_file",
    ({ text }) => {
      console.log("Writing text to file:", text);
      return { file_path: `/vfs/text${++fileCount}.md` };
    },
  ],
  [
    "system_request_user_input",
    ({ user_message, type }) => {
      console.log("Requesting user input:", user_message);
      if (type === "confirm") {
        return { text: "yes" };
      }
      if (type !== "image" && type !== "video") {
        throw new Error("Unsupported type");
      }
      const ext = type === "image" ? "jpeg" : "mp4";
      return { file_path: `/vfs/${type}${++fileCount}.${ext}` };
    },
  ],
]);

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
