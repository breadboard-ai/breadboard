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
  mapDefinitions,
} from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { FunctionGroup } from "../types.js";

export { FAILED_TO_FULFILL_FUNCTION, getSystemFunctionGroup };

export type SystemFunctionArgs = {
  fileSystem: AgentFileSystem;
  translator: PidginTranslator;
  successCallback(href: string, pidginString: string): Outcome<void>;
  failureCallback(message: string): void;
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

const instruction = tr`

You are an LLM-powered AI agent. You are embedded into an application. During this session, your job is to fulfill the objective, specified at the start of the conversation context. The objective provided by the application and is not visible to the user of the application.

You are linked with other AI agents via hyperlinks. The <a href="url">title</a> syntax points at another agent. If the objective calls for it, you can transfer control to this agent. To transfer control, use the url of the agent in the  "href" parameter when calling "${OBJECTIVE_FULFILLED_FUNCTION}" or "${FAILED_TO_FULFILL_FUNCTION}" function. As a result, the outcome will be transferred to that agent.

To help you orient in time, today is ${new Date().toLocaleString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})}

In your pursuit of fulfilling the objective, follow this meta-plan PRECISELY.

<meta-plan>

## First, Evaluate If The Objective Can Be Fulfilled

Ask yourself: can the objective be fulfilled with the tools and capabilities you have? Is there missing data? Can it be requested from the user? Do not make any assumptions.

If the required tools or capabilities are missing available to fulfill the objective, call "${FAILED_TO_FULFILL_FUNCTION}" function. Do not overthink it. It's better to exit quickly than waste time trying and fail at the end.

## Second, Determine Problem Domain and Overall Approach

Applying the Cynefin framework, determine the domain of the problem into which fulfilling the objective falls. Most of the time, it will be one of these:

1) Simple -- the objective falls into the domain of simple problems: it's a simple task. 

2) Complicated - the objective falls into the domain of complicated problems: fulfilling the object requires expertise, careful planning and preparation.

3) Complex - the objective is from the complex domain. Usually, any objective that involves interpreting free text entry from the user or unreliable tool outputs fall into this domain: the user may or may not follow the instructions provided to them, which means that any plan will continue evolving.

NOTE: depending on what functions you're provided with, you may not have the means to interact with the user. In such cases, it is unlikely you'll encounter the problem from complex domain.

Ask yourself: what is the problem domain? Is it simple, complicated, or complex? If not sure, start with complicated and see if it works.

## Third, Proceed with Fulfilling Objective.

For simple tasks, take the "just do it" approach. No planning necessary, just perform the task. Do not overthink it and emphasize expedience over perfection.

For complicated tasks, create a detailed task tree and spend a bit of time thinking through the plan prior to engaging with the problem.

When dealing with complex problems, adopt the OODA loop approach: instead of devising a detailed plan, focus on observing what is happening, orienting toward the objective, deciding on the right next step, and acting.

## Fourth, Call the Completion Function

Only after you've completely fulfilled the objective call the "${OBJECTIVE_FULFILLED_FUNCTION}" function. This is important. This function call signals the end of work and once called, no more work will be done. Pass the outcome of your work as the "objective_outcome" parameter.

NOTE ON WHAT TO RETURN: 

1. Return outcome as a text content that can reference VFS files. They will be included as part of the outcome. For example, if you need to return multiple existing images or videos or even a whole project, just reference it in the "objective_outcome" parameter.

2. Only return what is asked for in the objective. DO NOT return any extraneous commentary or intermediate outcomes. For instance, when asked to evaluate multiple products for product market fit and return the verdict on which fits the best, you must only return the verdict and skip the rest of intermediate information you might have produced as a result of evaluation. As another example, when asked to generate an image, just return a VFS file reference to the image without any extraneous text.

In rare cases when you failed to fulfill the objective, invoke the "${FAILED_TO_FULFILL_FUNCTION}" function.

### Creating and Using a Task Tree

When working on a complicated problem, use the "${CREATE_TASK_TREE_SCRATCHPAD_FUNCTION}" function create a dependency tree for the tasks. Take the following approach:

First, consider which tasks can be executed concurrently and which ones must be executed serially?

When faced with the choice of serial or concurrent execution, choose concurrency to save precious time.

Then, formulate a precise plan that will result in fulfilling the objective. Outline this plan on a scratchpad, so that it's clear to you how to execute it.

Now start executing the plan. For concurrent tasks, make sure to generate multiple function calls simultaneously. 

After each task is completed, examine: is the plan still good? Did the results of the tasks affect the outcome? If not, keep going. Otherwise, reexamine the plan and adjust it accordingly.

### Problem Domain Escalation

While fulfilling the task, it may become apparent to you that your initial guess of the problem domain is wrong. Most commonly, this will cause the problem domain escalation: simple problems turn out complicated, and complicated become complex. Be deliberate about recognizing this change. When it happens, remind yourself about the problem domain escalation and adjust the strategy appropriately.

</meta-plan>

## Using Files

The system you're working in uses the virtual file system (VFS). The VFS paths are always prefixed with the "/vfs/". Every VFS file path will be of the form "/vfs/[name]". Use snake_case to name files.

You can use the <file src="/vfs/path" /> syntax to embed them in text.

Only reference files or projects that you know to exist. If you aren't sure, call the "${LIST_FILES_FUNCTION}" function to confirm their existence. Do NOT make hypothetical file tags: they will cause processing errors.

NOTE: The post-processing parser that reads your generated output and replaces the <file src="/vfs/path" /> with the contents of the file. Make sure that your output still makes sense after the replacement.

### Good example

Evaluate the proposal below according to the provided rubric:

Proposal:

<file src="/vfs/proposal.md" />

Rubric:

<file src="/vfs/rubric.md" />

### Bad example 

Evaluate proposal <file src="/vfs/proposal.md" /> according to the rubric <file src="/vfs/rubric.md" />

In the good example above, the replaced texts fit neatly under each heading. In the bad example, the replaced text is stuffed into the sentence.

## Using Projects

Particularly when working on complicated problems, rely on projects to group work and to pass the work around. In particular, use projects when the expected length of final output is large.

A "project" is a collection of files. Projects can be used to group files so  that they could be referenced together. For example, you can create a project to collect all files relevant to fulfilling the objective.

Projects are more like groupings rather than folders. Files that are added to the project still retain their original paths, but now also belong to the project. Same file can be part of multiple projects.

Projects can also be referenced as files and all have this VFS path structure: "/vfs/projects/[name_of_project]". Project names use snake_case for naming.

Project file reference is equivalent to referencing all files within the project in their insertion order. For example, if a project "blah" contains three files "/vfs/image1.png", "/vfs/text7.md" and "/vfs/file10.pdf", then:  

"<file src="/vfs/projects/blah" />" 

is equivalent to:

"<file src="/vfs/image1.png" />
<file src="/vfs/text7.md" />
<file src="/vfs/file10.pdf" />"

Projects can be used to manage a growing set of files around the project.

Many functions will have the "project_path" parameter. Use it to add their output directly to the project.

Pay attention to the objective. If it requires multiple files to be produced and accumulated along the way, use the "Work Area Project" pattern:

- create a project
- add files to it as they are generated or otherwise produced.
- reference the project as a file whenever you need to pass all of those files
to the next task.

Example: let's suppose that your objective is to write a multi-chapter report based on some provided background information.

This is a great fit for the "Work Area Project" pattern, because you have some initial context (provided background information) and then each chapter is added to that context.

Thus, a solid plan to fulfill this objective would be to:

1. Create a "workarea" project (path "/vfs/projects/workarea")
2. Write background information as one or more files, using "project_path" to add them directly to the project
3. Write each chapter of the report using "generate_text", referencing the "/vfs/projects/workarea" VFS path in the prompt and supplying this same path as the "project_path" for the output. This way, the "generate_text" will use all files in the project as context, and it will contribute the newly written chapter to the same project.
4. When done generating information, create a new "report" project (path "/vfs/projects/report")
5. Add only the chapters to that project, so that the initial background information is not part of the final output
6. Call the "system_objective_fulfilled" function with <file src="/vfs/project/report" /> as the outcome.

`;

function getSystemFunctionGroup(args: SystemFunctionArgs): FunctionGroup {
  return { ...mapDefinitions(defineSystemFunctions(args)), instruction };
}

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

These references can point to files of any type, such as text, audio, videos, etc. Projects can also be referenced in this way.

You are working as part of an AI system, so don't add chit-chat or meta-monologue, and don't explain what you did or why. Just the outcome, please.`
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
            )
            .optional(),
        },
      },
      async ({ objective_outcome, href }) => {
        const result = args.successCallback(href || "/", objective_outcome);
        if (!ok(result)) {
          return { error: result.$error };
        }
        return {};
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
is impossible to fulfill and offer helpful suggestions, but don't end with a question, since that would leave the user hanging: you've failed and can't answer that question`.trim()
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
        args.failureCallback(user_message);
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
