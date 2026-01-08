/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types/data.js";
import { ok } from "@breadboard-ai/utils";
import z from "zod";
import { toText, tr } from "../../a2/utils.js";
import { AgentFileSystem } from "../file-system.js";
import {
  defineFunction,
  defineFunctionLoose,
  FunctionDefinition,
} from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";

export {
  CREATE_TASK_TREE_SCRATCHPAD_FUNCTION,
  defineSystemFunctions,
  FAILED_TO_FULFILL_FUNCTION,
  LIST_FILES_FUNCTION,
  OBJECTIVE_FULFILLED_FUNCTION,
};

const LIST_FILES_FUNCTION = "system_list_files";
const OBJECTIVE_FULFILLED_FUNCTION = "system_objective_fulfilled";
const FAILED_TO_FULFILL_FUNCTION = "system_failed_to_fulfill_objective";
const CREATE_TASK_TREE_SCRATCHPAD_FUNCTION = "create_task_tree_scratchpad";

const TASK_TREE_SCHEMA = {
  type: "object",
  definitions: {
    TaskNode: {
      type: "object",
      required: ["description", "execution_mode"],
      properties: {
        description: {
          type: "string",
          description:
            "Detailed explanation of what fulfilling this objective entails.",
        },
        execution_mode: {
          type: "string",
          description:
            "Defines how immediate subtasks should be executed. 'serial' means one by one in order; 'concurrent' means all at the same time.",
          enum: ["serial", "concurrent"],
        },
        subtasks: {
          type: "array",
          description:
            "Ordered list of child tasks. If execution_mode is serial, the order matters.",
          items: {
            $ref: "#/definitions/TaskNode",
          },
        },
      },
    },
  },
  properties: {
    taskTree: {
      type: "object",
      $ref: "#/definitions/TaskNode",
    },
  },
};

export type SystemFunctionArgs = {
  fileSystem: AgentFileSystem;
  translator: PidginTranslator;
  successCallback(href: string, pidginString: string): Outcome<void>;
  terminateCallback(): void;
};

function defineSystemFunctions(args: SystemFunctionArgs): FunctionDefinition[] {
  return [
    defineFunction(
      {
        name: OBJECTIVE_FULFILLED_FUNCTION,
        description: `Inidicates completion of the overall objective. 
Call only when the specified objective is entirely fulfilled`,
        parameters: {
          objective_outcome: z.string().describe(
            tr`
Your return value: the content of the fulfilled objective. The content may include references to VFS files. For instance, if you have an existing file at "/vfs/image4.png", you can reference it as <file src="/vfs/image4.ong" /> in content. If you do not use <file> tags, the contents of this file will not be included as part of the outcome.

These references can point to files of any type, such as text, audio, videos, etc. Projects can also be referenced in this way.`
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
        response: {
          error: z
            .string()
            .describe(
              `A detailed error message that usually indicates invalid parameters being passed into the function`
            ),
        },
      },
      async ({ objective_outcome, href }) => {
        const result = args.successCallback(href || "/", objective_outcome);
        if (!ok(result)) {
          return { error: result.$error };
        }
        return { error: "" };
      }
    ),
    defineFunction(
      {
        name: FAILED_TO_FULFILL_FUNCTION,
        description: `Inidicates that the agent failed to fulfill of the overall
objective. Call ONLY when all means of fulfilling the objective have been
exhausted.`,
        parameters: {
          user_message: z.string().describe(
            `
Text to display to the user upon admitting failure to
fulfill the objective. Provide a friendly explanation of why the objective
is impossible to fulfill and offer helpful suggestions`.trim()
          ),
          href: z
            .string()
            .describe(
              `
The url of the next agent to which to transfer control upon
failure. By default, the control is transferred to the root agent "/". 
If the objective specifies other agent URLs using the
 <a href="url">title</a> syntax, and calls to choose a different agent to which
 to  transfer control, then that url should be used instead.`.trim()
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
        name: LIST_FILES_FUNCTION,
        description: "Lists all VFS files",
        parameters: {},
        response: {
          list: z.string().describe("List of all files as VFS paths"),
        },
      },
      async () => {
        return { list: await args.fileSystem.listFiles() };
      }
    ),
    defineFunction(
      {
        name: "system_write_text_to_file",
        description: "Writes the provided text to a VFS file",
        parameters: {
          file_name: z.string().describe(
            `
The name of the file without the extension.
This is the name that will come after the "/vfs/" prefix in the VFS file path.
Use snake_case for naming.`.trim()
          ),
          project_path: z
            .string()
            .describe(
              `
The VFS path to a project. If specified, the result will be added to that
project. Use this parameter as a convenient way to add newly created file to an
existing project.`.trim()
            )
            .optional(),
          text: z.string().describe(`The text to write into a VFS file`),
        },
        response: {
          file_path: z
            .string()
            .describe("The VS path to the file containing the provided text")
            .optional(),
          error: z
            .string()
            .describe("The error message if the file could not be written")
            .optional(),
        },
      },
      async ({ file_name, project_path, text }) => {
        console.log("FILE_NAME", file_name);
        console.log("TEXT TO WRITE", text);
        const translatedContent = await args.translator.fromPidginString(text);
        if (!ok(translatedContent)) {
          return { error: translatedContent.$error };
        }
        const file_path = args.fileSystem.write(
          file_name,
          toText(translatedContent),
          "text/markdown"
        );
        if (project_path) {
          args.fileSystem.addFilesToProject(project_path, [file_path]);
        }
        return { file_path };
      }
    ),
    defineFunction(
      {
        name: "system_write_json_to_file",
        description: "Writes the provided JSON string to a file",
        parameters: {
          file_name: z.string().describe(
            `
The name of the file without the extension.
This is the name that will come after the "/vfs/" prefix in the VFS file path.
Use snake_case for naming.`.trim()
          ),
          project_path: z
            .string()
            .describe(
              `
The VFS path to a project. If specified, the result will be added to that
project. Use this parameter as a convenient way to add newly created file to an
existing project.`.trim()
            )
            .optional(),
          text: z.string().describe(`The text to write into a VFS file`),
        },
        response: {
          file_path: z
            .string()
            .describe("The VS path to the file containing the provided text"),
        },
      },
      async ({ file_name, project_path, text }) => {
        console.log("FILE_NAME", file_name);
        console.log("JSON TO WRITE", text);
        const file_path = args.fileSystem.write(
          file_name,
          text,
          "application/javascript"
        );
        if (project_path) {
          args.fileSystem.addFilesToProject(project_path, [file_path]);
        }
        return { file_path };
      }
    ),
    defineFunction(
      {
        name: "system_append_text_to_file",
        description: "Appends provided text to a file",
        parameters: {
          file_path: z.string().describe(
            tr`
  
The VFS path of the file to which to append text. If a file does not
exist, it will be created`
          ),
          project_path: z.string().describe(
            `
The VFS path to a project. If specified, the result will be added to that
project. Use this parameter as a convenient way to add newly created file to an
existing project.`.trim()
          ),
          text: z.string().describe(`The text to append to the file`),
        },
        response: {
          file_path: z
            .string()
            .describe("The VS path to the file to which the text was appended")
            .optional(),
          error: z
            .string()
            .describe(
              tr`

If an error has occurred, will contain a description of the error`
            )
            .optional(),
        },
      },
      async ({ file_path, project_path, text }) => {
        console.log("FILE_NAME", file_path);
        console.log("TEXT TO APPEND", text);
        const appending = args.fileSystem.append(file_path, text);
        if (!ok(appending)) return { error: appending.$error };

        if (project_path) {
          args.fileSystem.addFilesToProject(project_path, [file_path]);
        }
        return { file_path };
      }
    ),
    defineFunction(
      {
        name: "system_read_text_from_file",
        description:
          "Reads text from a file and return text as string. If the file does not contain text, empty string will be returned",
        parameters: {
          file_path: z.string().describe(
            tr`
The VFS path of the file to read the text from.`.trim()
          ),
        },
        response: {
          text: z
            .string()
            .describe(
              tr`
The text contents of a file as a string.`
            )
            .optional(),
          error: z
            .string()
            .describe(
              tr`

If an error has occurred, will contain a description of the error`
            )
            .optional(),
        },
      },
      async ({ file_path }) => {
        console.log("FILE PATH", file_path);
        const text = await args.fileSystem.readText(file_path);
        if (!ok(text)) return { error: text.$error };
        return { text };
      }
    ),
    defineFunction(
      {
        name: "system_create_project",
        description: `Creates a project with the provided name. A project is a
collection of files. Projects can be used to group files so that they could be
referenced together. For example, you can create a project to collect all files relevant to the fulfilling the objective. 

Projects are more like groupings rather than folders. Files that are added to 
the project still retain their original paths, but now also belong to the 
project. Same file can be part of multiple projects.

Projects can also be referenced as files and all have this VFS path structure:
"/vfs/projects/[name_of_project]".

Such a file reference is equivalent to referencing all files within the project
in their insertion order. For example, if a project "blah" contains three files:
"/vfs/image1.png", "/vfs/text7.md" and "/vfs/file10.pdf", 
then  

"<file src="/vfs/projects/blah" />" 

is equivalent to:

"<file src="/vfs/image1.png" />
<file src="/vfs/text7.md" />
<file src="/vfs/file10.pdf" />"
`,
        parameters: {
          name: z.string().describe(`Name of the project. This is the name that
will come after "/vfs/projects/" prefix in the file path. Use snake_case for
naming.`),
        },
        response: {
          file_path: z.string().describe(`The VFS path to the project. Will be
in the form of "/vfs/projects/[name_of_project]".`),
        },
      },
      async ({ name }) => {
        return { file_path: args.fileSystem.createProject(name) };
      }
    ),
    defineFunction(
      {
        name: "system_add_files_to_project",
        description: `Adds files to a project`,
        parameters: {
          project_file_path: z.string().describe(`The VFS path to the project
to which to add files`),
          files_to_add: z.array(
            z.string().describe(`
The VFS path to a file to add to the project`)
          ),
        },
        response: {
          report: z.string().describe(`A brief report on the updated contents of
the file`),
        },
      },
      async ({ project_file_path, files_to_add }) => {
        const result = args.fileSystem.addFilesToProject(
          project_file_path,
          files_to_add
        );

        return {
          report: `
- Total files: ${result.total}
- Existing files: ${result.existing.join(", ")}
- Added files: ${result.added.join(", ")}`,
        };
      }
    ),
    defineFunction(
      {
        name: "system_list_project_contents",
        description: `Lists all files currently in the project`,
        parameters: {
          project_file_path: z.string().describe(`The VFS path to the project`),
        },
        response: {
          file_paths: z.array(
            z.string().describe(`
The VFS path to a file that is in this project
`)
          ),
        },
      },
      async ({ project_file_path }) => {
        return {
          file_paths: args.fileSystem.listProjectContents(project_file_path),
        };
      }
    ),
    defineFunctionLoose(
      {
        name: CREATE_TASK_TREE_SCRATCHPAD_FUNCTION,
        description:
          "When working on complicated problem, use this throw-away scratch pad to reason about a dependency tree of tasks, like about the order of tasks, and which tasks can be executed concurrently and which ones must be executed serially. To better help yourself, make sure to include all meta-tasks: formatting/preparing the outputs, creating or updating projects, and so on.",
        parametersJsonSchema: TASK_TREE_SCHEMA,
        responseJsonSchema: {
          type: "object",
          properties: {
            taskTreeSaved: {
              type: "boolean",
            },
          },
        },
      },
      async (params) => {
        console.log("PARAMS", params);
        return { taskTreeSaved: true };
      }
    ),
  ];
}
