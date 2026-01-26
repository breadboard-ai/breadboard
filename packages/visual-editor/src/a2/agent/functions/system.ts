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
  type ArgsRawShape,
} from "../function-definition.js";
import { PidginTranslator } from "../pidgin-translator.js";
import {
  TASK_TREE_SCHEMA,
  TaskTree,
  TaskTreeManager,
} from "../task-tree-manager.js";
import { FunctionGroup } from "../types.js";

export {
  FAILED_TO_FULFILL_FUNCTION,
  getSystemFunctionGroup,
  statusUpdateSchema,
  taskIdSchema,
};

export type SystemFunctionArgs = {
  fileSystem: AgentFileSystem;
  translator: PidginTranslator;
  taskTreeManager: TaskTreeManager;
  successCallback(href: string, pidginString: string): Outcome<void>;
  failureCallback(message: string): void;
};

const LIST_FILES_FUNCTION = "system_list_files";
const OBJECTIVE_FULFILLED_FUNCTION = "system_objective_fulfilled";
const FAILED_TO_FULFILL_FUNCTION = "system_failed_to_fulfill_objective";
const CREATE_TASK_TREE_FUNCTION = "system_create_task_tree";
const MARK_COMPLETED_TASKS_FUNCTION = "system_mark_completed_tasks";

const OBJECTIVE_OUTCOME_PARAMETER = "objective_outcome";
const TASK_ID_PARAMETER = "task_id";

const statusUpdateSchema = {
  status_update: z.string().describe(tr`
  A status update to show in the UI that provides more detail on the reason why this function was called.
  
  For example, "Creating random values", "Writing the memo", "Generating videos", "Making music", etc.`),
} satisfies ArgsRawShape;

const taskIdSchema = {
  [TASK_ID_PARAMETER]: z
    .string(
      tr`If applicable, the "task_id" value of the relevant task in the task tree.`
    )
    .optional(),
} satisfies ArgsRawShape;

const instruction = tr`

You are an LLM-powered AI agent, orchestrated within an application alongside other AI agents. During this session, your job is to fulfill the objective, specified at the start of the conversation context. The objective provided by the application and is not visible to the user of the application. Similarly, the outcome you produce is delivered by the orchestration system to another agent. The outcome is also not visible to the user to the application.

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

## STEP 1. Evaluate If The Objective Can Be Fulfilled

Ask yourself: can the objective be fulfilled with the tools and capabilities you have? Is there missing data? Can it be requested from the user? Do not make any assumptions.

If the required tools or capabilities are missing available to fulfill the objective, call "${FAILED_TO_FULFILL_FUNCTION}" function. Do not overthink it. It's better to exit quickly than waste time trying and fail at the end.

## STEP 2. Determine Problem Domain and Overall Approach

Applying the Cynefin framework, determine the domain of the problem into which fulfilling the objective falls. Most of the time, it will be one of these:

1) Simple -- the objective falls into the domain of simple problems: it's a simple task. 

2) Complicated - the objective falls into the domain of complicated problems: fulfilling the object requires expertise, careful planning and preparation.

3) Complex - the objective is from the complex domain. Usually, any objective that involves interpreting free text entry from the user or unreliable tool outputs fall into this domain: the user may or may not follow the instructions provided to them, which means that any plan will continue evolving.

NOTE: depending on what functions you're provided with, you may not have the means to interact with the user. In such cases, it is unlikely you'll encounter the problem from complex domain.

Ask yourself: what is the problem domain? Is it simple, complicated, or complex? If not sure, start with complicated and see if it works.

## STEP 3. Proceed with Fulfilling Objective.

For simple tasks, take the "just do it" approach. No planning necessary, just perform the task. Do not overthink it and emphasize expedience over perfection.

For complicated tasks, create a detailed task tree and spend a bit of time thinking through the plan prior to engaging with the problem.

When dealing with complex problems, adopt the OODA loop approach: instead of devising a detailed plan, focus on observing what is happening, orienting toward the objective, deciding on the right next step, and acting.

### Creating and Using a Task Tree

When working on a complicated problem, use the "${CREATE_TASK_TREE_FUNCTION}" function create a dependency tree for the tasks. Every task must loosely correspond to a function being called.

Take the following approach:

First, consider which tasks can be executed concurrently and which ones must be executed serially?

When faced with the choice of serial or concurrent execution, choose concurrency to save precious time.

Now, start executing the plan. 

For concurrent tasks, make sure to generate multiple function calls simultaneously. 

To better match function calls to tasks, use the "${TASK_ID_PARAMETER}" parameter in the function calls. To express more granularity within a task, add extra identifiers at the end like this: "task_001_1". This means "task_001, part 1".

After each task is completed, examine: is the plan still good? Did the results of the tasks affect the outcome? If not, keep going. Otherwise, reexamine the plan and adjust it accordingly.

Use the "${MARK_COMPLETED_TASKS_FUNCTION}" function to keep track of the completed tasks. All tasks are automatically marked as completed when the "${OBJECTIVE_FULFILLED_FUNCTION}" is called, so avoid the unnecessary "${MARK_COMPLETED_TASKS_FUNCTION}" function calls at the end. 

### Problem Domain Escalation

While fulfilling the task, it may become apparent to you that your initial guess of the problem domain is wrong. Most commonly, this will cause the problem domain escalation: simple problems turn out complicated, and complicated become complex. Be deliberate about recognizing this change. When it happens, remind yourself about the problem domain escalation and adjust the strategy appropriately.

## STEP 4. Return the objective outcome

Only after you've completely fulfilled the objective call the "${OBJECTIVE_FULFILLED_FUNCTION}" function. This is important. This function call signals the end of work and once called, no more work will be done. Pass the outcome of your work as the "${OBJECTIVE_OUTCOME_PARAMETER}" parameter.

### What to return

Return outcome as a text content that can reference VFS files. They will be included as part of the outcome. For example, if you need to return multiple existing images or videos, just reference them using <file> tags in the "${OBJECTIVE_OUTCOME_PARAMETER}" parameter.

Only return what is asked for in the objective. DO NOT return any extraneous commentary, labels, or intermediate outcomes. The outcome is delivered to another agent and the extraneous chit-chat or additional information, while it may seem valuable, will only confuse the next agent.

### How to determine what to return

1. Examine the objective and see if there is an instruction with the verb "return". If so, the outcome must be whatever is specified in the instruction.

Example: "evaluate multiple products for product market fit and return the verdict on which fits the best" -- the outcome is the verdict only.

2. If there's not "return" instruction, identify the key artifact of the objective and return that.

Example 1: "research the provided topic and generate an image of ..." -- return just a VFS file reference to the image without any extraneous text.

Example 2: "Make a blog post writer. It ... shows the header graphic and the blog post as a final result" -- return just the header graphic as a VFS file reference and a blog post.

3. If the objective is not calling for any outcome to be returned, it is perfectly fine to return an empty string as outcome. The mere fact of calling the "${OBJECTIVE_FULFILLED_FUNCTION}" function is an outcome in itself.

Example 2: "Examine the state and if it's empty, go to ... otherwise, go to ..." -- return an empty string.

IMPORTANT: DO NOT start the "${OBJECTIVE_OUTCOME_PARAMETER}" parameter value with a "Here is ..." or "Okay", or "Alright" or any preambles. You are working as part of an AI system, so no chit-chat and no explaining what you're doing and why. Just the output, please. 

In situations when you failed to fulfill the objective, invoke the "${FAILED_TO_FULFILL_FUNCTION}" function.


</meta-plan>

## Using Files

The system you're working in uses the virtual file system (VFS). The VFS paths are always prefixed with the "/vfs/". Every VFS file path will be of the form "/vfs/[name]". Use snake_case to name files.

You can use the <file src="/vfs/path" /> syntax to embed them in text.

Only reference files that you know to exist. If you aren't sure, call the "${LIST_FILES_FUNCTION}" function to confirm their existence. Do NOT make hypothetical file tags: they will cause processing errors.

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
            tr`
Text to display to the user upon admitting failure to
fulfill the objective. Provide a friendly explanation of why the objective
is impossible to fulfill and offer helpful suggestions, but don't end with a question, since that would leave the user hanging: you've failed and can't answer that question`
          ),
          href: z
            .string()
            .describe(
              tr`
The url of the next agent to which to transfer control upon
failure. By default, the control is transferred to the root agent "/". 
If the objective specifies other agent URLs using the
 <a href="url">title</a> syntax, and calls to choose a different agent to which
 to  transfer control, then that url should be used instead.`
            )
            .default("/"),
        },
      },
      async ({ user_message }) => {
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
        name: "system_write_file",
        description: "Writes the provided text to a VFS file",
        parameters: {
          file_name: z.string().describe(
            tr`
The name of the file without the extension.
This is the name that will come after the "/vfs/" prefix in the VFS file path.
Use snake_case for naming. If the file does not exist, it will be created. If the file already exists, its content will be overwritten`
          ),
          content: z.string().describe(`The content to write into a VFS file`),
          mime_type: z
            .string()
            .describe(
              `The text MIME type of the content, such as "text/plain", "application/json", "text/csv", etc.`
            )
            .default("text/plain"),
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
      async ({ file_name, content, mime_type }) => {
        const translatedContent =
          await args.translator.fromPidginString(content);
        if (!ok(translatedContent)) {
          return { error: translatedContent.$error };
        }
        const file_path = args.fileSystem.write(
          file_name,
          toText(translatedContent),
          mime_type
        );
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
The VFS path of the file to read the text from.`
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
        const text = await args.fileSystem.readText(file_path);
        if (!ok(text)) return { error: text.$error };
        return { text };
      }
    ),
    defineFunctionLoose(
      {
        name: CREATE_TASK_TREE_FUNCTION,
        description: tr`

When working on a complicated problem, use this function to create a scratch pad to reason about a dependency tree of tasks, like about the order of tasks, and which tasks can be executed concurrently and which ones must be executed serially.

`,
        parametersJsonSchema: TASK_TREE_SCHEMA,
        responseJsonSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
            },
          },
        },
      },
      async ({ task_tree }) => {
        const file_path = args.taskTreeManager.set(task_tree as TaskTree);
        return { file_path };
      }
    ),
    defineFunction(
      {
        name: MARK_COMPLETED_TASKS_FUNCTION,
        description: tr`
Mark one or more tasks defined with the "${CREATE_TASK_TREE_FUNCTION}" as complete.
`,
        parameters: {
          task_ids: z
            .array(
              z.string(tr`
The "task_id" from the task tree to mark as completed`)
            )
            .describe("The list of tasks to mark as completed"),
        },
        response: {
          file_path: z
            .string()
            .describe("The VFS path to the updated task tree"),
        },
      },
      async ({ task_ids }) => {
        const file_path = args.taskTreeManager.setComplete(task_ids);
        return { file_path };
      }
    ),
  ];
}
