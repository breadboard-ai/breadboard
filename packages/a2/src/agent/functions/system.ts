/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { defineFunction, FunctionDefinition } from "../function-definition";
import { AgentFileSystem } from "../file-system";
import { AgentUI } from "../ui";

export { initializeSystemFunctions };

export type SystemFunctionArgs = {
  ui: AgentUI;
  fileSystem: AgentFileSystem;
  successCallback(
    user_message: string,
    href: string,
    objective_outcomes: string[],
    intermediate_files: string[]
  ): void;
  terminateCallback(): void;
};

function initializeSystemFunctions(
  args: SystemFunctionArgs
): FunctionDefinition[] {
  return [
    defineFunction(
      {
        name: "system_objective_fulfilled",
        description: `Inidicates completion of the overall objective. 
Call only when the specified objective is entirely fulfilled`,
        parameters: {
          user_message: z.string()
            .describe(`Text to display to the user upon fulfillment of the objective. 
Use the <file src="path" /> syntax to embed the outcome in the text`),
          objective_outcomes: z
            .array(z.string().describe(`A VFS path pointing at the outcome`))
            .describe(
              `The array of outcomes that were requested in the objective`
            ),
          intermediate_files: z.array(
            z.string().describe(`A VFS path pointing at the outcome`)
              .describe(`Any intermediate files that were produced as a result 
of fulfilling the objective `)
          ),
          href: z
            .string()
            .describe(
              `The url of the next agent to which to transfer control upon
completion. By default, the control is transferred to the root agent "/". 
If the objective specifies other agent URLs using the
 <a href="url">title</a> syntax, and calls to choose a different agent to which
 to  transfer control, then that url should be used instead.`
            )
            .default("/"),
        },
      },
      async ({
        user_message,
        objective_outcomes,
        intermediate_files,
        href,
      }) => {
        args.successCallback(
          user_message,
          href || "/",
          objective_outcomes,
          intermediate_files
        );
        return {};
      }
    ),
    defineFunction(
      {
        name: "system_failed_to_fulfill_objective",
        description: `Inidicates that the agent failed to fulfill of the overall
objective. Call ONLY when all means of fulfilling the objective have been
exhausted.`,
        parameters: {
          user_message: z.string()
            .describe(`Text to display to the user upon admitting failure to
fulfill the objective. Provide a friendly explanation of why the objective
is impossible to fulfill and offer helpful suggestions`),
          href: z
            .string()
            .describe(
              `The url of the next agent to which to transfer control upon
failure. By default, the control is transferred to the root agent "/". 
If the objective specifies other agent URLs using the
 <a href="url">title</a> syntax, and calls to choose a different agent to which
 to  transfer control, then that url should be used instead.`
            )
            .default("/"),
        },
      },
      async ({ user_message }) => {
        console.log("FAILURE! Failed to fulfill the objective");
        console.log("User message:", user_message);
        args.terminateCallback();
        return {};
      }
    ),
    defineFunction(
      {
        name: "system_write_text_to_file",
        description: "Writes provided text to a VFS file",
        parameters: {
          text: z.string().describe(`The text to write into a VFS file`),
        },
        response: {
          file_path: z
            .string()
            .describe("The VS path to the file containing the provided text"),
        },
      },
      async ({ text }) => {
        console.log("Writing text to file:", text);
        const file_path = args.fileSystem.write(text, "text/markdown");
        return { file_path };
      }
    ),
    defineFunction(
      {
        name: "system_request_user_input",
        description: `Requests input from a user. Use this function to obtain
additional information or confirmation from the user. Use only when necessary.
Avoid excessive requests to the user.`,
        parameters: {
          user_message: z.string()
            .describe(`Text to display to the user when requesting input.
Use the <file src="path" /> syntax to embed any files in the message`),
          type: z.enum([
            "singleline-text",
            "multiline-text",
            "confirm",
            "image",
            "video",
          ]).describe(`Type of the input requested.
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
`),
        },
        response: {
          text: z
            .string()
            .optional()
            .describe(
              `The text response from the user, populated when the "type" is "singleline-text", "multiline-text", or "confirm".`
            ),
          file_path: z.string().optional().describe(`The VFS path to the file,
uploaded by the user, populated when the "type" is "image", or "video".`),
        },
      },
      async ({ user_message, type }) => {
        return args.ui.requestUserInput(user_message, type);
      }
    ),
  ];
}
