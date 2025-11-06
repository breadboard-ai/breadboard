/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import z from "zod";
import { defineFunction, FunctionDefinition } from "../function-definition";
import { AgentFileSystem } from "../file-system";
import { ok } from "@breadboard-ai/utils";

export { defineSystemFunctions };

export type SystemFunctionArgs = {
  fileSystem: AgentFileSystem;
  successCallback(
    user_message: string,
    href: string,
    objective_outcomes: string[]
  ): void;
  terminateCallback(): void;
};

function defineSystemFunctions(args: SystemFunctionArgs): FunctionDefinition[] {
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
      async ({ user_message, objective_outcomes, href }) => {
        args.successCallback(user_message, href || "/", objective_outcomes);
        return {};
      },
      () => "Declaring Success"
    ),
    defineFunction(
      {
        name: "system_failed_to_fulfill_objective",
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
      },
      () => "Admitting Defeat"
    ),
    defineFunction(
      {
        name: "system_write_text_to_file",
        description: "Writes provided text to a file",
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
        console.log("TEXT TO WRITE", text);
        const file_path = args.fileSystem.write(
          file_name,
          text,
          "text/markdown"
        );
        if (project_path) {
          args.fileSystem.addFilesToProject(project_path, [file_path]);
        }
        return { file_path };
      },
      () => "Storing Data to Remember Later"
    ),
    defineFunction(
      {
        name: "system_append_text_to_file",
        description: "Appends provided text to a file",
        parameters: {
          file_path: z.string().describe(
            `
The VFS path of the file to which to append text. If a file does not
exist, it will be created`.trim()
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
            .describe("The VS path to the file to which the text was appended"),
        },
      },
      async ({ file_path, project_path, text }) => {
        console.log("FILE_NAME", file_path);
        console.log("TEXT TO APPEND", text);
        const appending = args.fileSystem.append(file_path, text);
        if (!ok(appending)) return appending;
        if (project_path) {
          args.fileSystem.addFilesToProject(project_path, [file_path]);
        }
        return { file_path };
      },
      () => "Adding Data to Remember Later"
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
      },
      ({ name }) => `Creating a new project "${name}"`
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
      },
      () => "Adding Data to Project"
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
      },
      () => "Examining Project Contents"
    ),
  ];
}
