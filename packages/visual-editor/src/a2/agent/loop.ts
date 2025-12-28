/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { Params } from "../a2/common.js";
import {
  conformGeminiBody,
  GeminiBody,
  streamGenerateContent,
  Tool,
} from "../a2/gemini.js";
import { llm } from "../a2/utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { prompt as a2UIPrompt } from "./a2ui/prompt.js";
import { SmartLayoutPipeline } from "./a2ui/smart-layout-pipeline.js";
import { AgentFileSystem } from "./file-system.js";
import { FunctionCallerImpl } from "./function-caller.js";
import { emptyDefinitions, mapDefinitions } from "./function-definition.js";
import { defineGenerateFunctions } from "./functions/generate.js";
import {
  CREATE_TASK_TREE_SCRATCHPAD_FUNCTION,
  defineSystemFunctions,
  FAILED_TO_FULFILL_FUNCTION,
  OBJECTIVE_FULFILLED_FUNCTION,
} from "./functions/system.js";
import { PidginTranslator } from "./pidgin-translator.js";
import { AgentUI } from "./ui.js";

export { Loop };

export type AgentRunArgs = {
  objective: LLMContent;
  params: Params;
  enableUI?: boolean;
  uiPrompt?: LLMContent;
};

export type AgentRawResult = {
  success: boolean;
  href: string;
  objective_outcome: string;
};

export type AgentResult = {
  /**
   * Whether or not agent succeeded in fulfilling the objective.
   */
  success: boolean;
  /**
   * The url of the next agent to which to transfer control
   */
  href: string;
  /**
   * The outcomes of the loop. Will be `undefined` when success = false
   */
  outcomes: LLMContent | undefined;
  /**
   * Intermediate results that might be worth keeping around. Will be
   * `undefined` when success = false
   */
  intermediate?: FileData[];
};

export type FileData = {
  path: string;
  content: LLMContent;
};

type SystemInstructionArgs = {
  useUI: boolean;
};

const AGENT_MODEL = "gemini-3-flash-preview";

function createSystemInstruction(args: SystemInstructionArgs) {
  return llm`
You are an LLM-powered AI agent. You are embedded into an application. Your job is to fulfill the objective, specified at the start of the conversation context. The objective provided by the application and is not visible to the user of the application.

You are linked with other AI agents via hyperlinks. The <a href="url">title</a> syntax points at another agent. If the objective calls for it, you can transfer control to this agent. To transfer control, use the url of the agent in the  "href" parameter when calling "${OBJECTIVE_FULFILLED_FUNCTION}" or "${FAILED_TO_FULFILL_FUNCTION}" function. As a result, the outcome will be transferred to that agent.

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

For simple tasks, take the "just do it" approach. No planning necessary, just perform the task.

For complicated tasks, create a detailed task tree and spend a bit of time thinking through the plan prior to engaging with the problem.

When dealing with complex problems, adopt the OODA loop approach: instead of devising a detailed plan, focus on observing what is happening, orienting toward the objective, deciding on the right next step, and acting.

## Fourth, Call the Completion Function

Only after you've completely fulfilled the objective call the "${OBJECTIVE_FULFILLED_FUNCTION}" function. This is important. This function call signals the end of work and once called, no more work will be done. Pass the outcome of your work as the "objective_outcome" parameter.

NOTE ON WHAT TO RETURN: 

1. Return outcome as a text content that can reference VFS files. They will be included as part of the outcome. For example, if you need to return multiple existing images or videos or even a whole project, just reference it in the "objective_outcome" parameter.

2. Only return what is asked for in the objective. Do not return any extraneous commentary or intermediate outcomes. For instance, when asked to evaluate multiple products for product market fit and return the verdict on which fits the best, you must only return the verdict and skip the rest of intermediate information you might have produced as a result of evaluation.

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

Here are the additional agent instructions for you. These will make your life a lot easier. Pay attention to them.

<agent-instructions>

## When to call generate_text

When evaluating the objective, make sure to determine whether calling "generate_text" is warranted. The key tradeoff here is latency: because it's an additional model call, the "generate_text" will take longer to finish.

Your job is to fulfill the objective as efficiently as possible, so weigh the need to invoke "generate_text" carefully.

Here is the rules of thumb:

- For shorter responses like a chat conversation, just do the text generation yourself. You are an LLM and you can do it without calling "generate_text".
- For longer responses like generating a chapter of a book or analyzing a large and complex set of files, use "generate_text".

</agent-instructions>

<agent-instructions>

## Using Files

The system you're working in uses the virtual file system (VFS). The VFS paths are always prefixed with the "/vfs/". Every VFS file path will be of the form "/vfs/[name]". Use snake_case to name files.

You can use the <file src="/vfs/path" /> syntax to embed them in text.

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

</agent-instructions>

<agent-instructions>

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
6. Call the "system_objective_fulfilled" function with the "/vfs/project/report" as the outcome.

</agent-instructions>

<agent-instructions>

## Interacting with the User

${args.useUI ? a2UIPrompt : `You do not have a way to interact with the user during your session, aside from the final output when calling "${OBJECTIVE_FULFILLED_FUNCTION}" or "${FAILED_TO_FULFILL_FUNCTION}" function`}

</agent-instructions>

`.asContent();
}

/**
 * The main agent loop
 */
class Loop {
  private readonly translator: PidginTranslator;
  private readonly fileSystem: AgentFileSystem;
  private readonly ui: AgentUI;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs
  ) {
    this.fileSystem = new AgentFileSystem();
    this.translator = new PidginTranslator(caps, moduleArgs, this.fileSystem);
    this.ui = new AgentUI(caps, moduleArgs, this.translator);
  }

  async run({
    objective,
    params,
    uiPrompt,
    enableUI = false,
  }: AgentRunArgs): Promise<Outcome<AgentResult>> {
    const { caps, moduleArgs, fileSystem, translator, ui } = this;

    ui.progress.startAgent(objective);
    try {
      const objectivePidgin = await translator.toPidgin(objective, params);
      if (!ok(objectivePidgin)) return objectivePidgin;

      const contents: LLMContent[] = [
        llm`<objective>${objectivePidgin.text}</objective>`.asContent(),
      ];

      let terminateLoop = false;
      let result: AgentRawResult = {
        success: false,
        href: "",
        objective_outcome: "",
      };

      const systemFunctions = mapDefinitions(
        defineSystemFunctions({
          fileSystem,
          terminateCallback: () => {
            terminateLoop = true;
          },
          successCallback: (href, objective_outcome) => {
            terminateLoop = true;
            console.log("SUCCESS! Objective fulfilled");
            console.log("Transfer control to", href);
            console.log("Objective outcomes:", objective_outcome);
            result = {
              success: true,
              href,
              objective_outcome,
            };
          },
        })
      );

      const generateFunctions = mapDefinitions(
        defineGenerateFunctions({
          fileSystem,
          caps,
          moduleArgs,
          translator,
        })
      );

      let uiFunctions = emptyDefinitions();

      if (enableUI) {
        const layoutPipeline = new SmartLayoutPipeline({
          caps,
          moduleArgs,
          fileSystem,
          translator,
          ui,
        });
        ui.progress.generatingLayouts(uiPrompt);
        console.time("LAYOUT GENERATION");
        const layouts = await layoutPipeline.prepareFunctionDefinitions(
          llm`${objective}\n\n${uiPrompt}`.asContent(),
          params
        );
        console.timeEnd("LAYOUT GENERATION");
        if (!ok(layouts)) return layouts;
        uiFunctions = mapDefinitions(layouts);
      }

      const objectiveTools = objectivePidgin.tools.list().at(0);
      const tools: Tool[] = [
        {
          ...objectiveTools,
          functionDeclarations: [
            ...(objectiveTools?.functionDeclarations || []),
            ...systemFunctions.declarations,
            ...generateFunctions.declarations,
            ...uiFunctions.declarations,
          ],
        },
      ];
      const functionDefinitionMap = new Map([
        ...systemFunctions.definitions,
        ...generateFunctions.definitions,
        ...uiFunctions.definitions,
      ]);

      while (!terminateLoop) {
        const body: GeminiBody = {
          contents,
          generationConfig: {
            temperature: 1,
            topP: 1,
            thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
          },
          systemInstruction: createSystemInstruction({
            useUI: enableUI,
          }),
          toolConfig: {
            functionCallingConfig: { mode: "ANY" },
          },
          tools,
        };
        const conformedBody = await conformGeminiBody(moduleArgs, body);
        if (!ok(conformedBody)) return conformedBody;

        ui.progress.sendRequest(AGENT_MODEL, conformedBody);

        const generated = await streamGenerateContent(
          AGENT_MODEL,
          conformedBody,
          moduleArgs
        );
        if (!ok(generated)) return generated;
        const functionCaller = new FunctionCallerImpl(
          functionDefinitionMap,
          objectivePidgin.tools
        );
        for await (const chunk of generated) {
          const content = chunk.candidates?.at(0)?.content;
          if (!content) {
            return err(
              `Agent unable to proceed: no content in Gemini response`
            );
          }
          contents.push(content);
          const parts = content.parts || [];
          for (const part of parts) {
            if (part.thought) {
              if ("text" in part) {
                console.log("THOUGHT", part.text);
                ui.progress.thought(part.text);
              } else {
                console.log("INVALID THOUGHT", part);
              }
            }
            if ("functionCall" in part) {
              ui.progress.functionCall(part);
              functionCaller.call(part, (status, opts) =>
                ui.progress.functionCallUpdate(part, status, opts)
              );
            }
          }
        }
        const functionResults = await functionCaller.getResults();
        if (!functionResults) continue;
        if (!ok(functionResults)) {
          return err(`Agent unable to proceed: ${functionResults.$error}`);
        }
        ui.progress.functionResult(functionResults);
        contents.push(functionResults);
      }
      return this.#finalizeResult(result);
    } finally {
      ui.progress.finish();
    }
  }

  #finalizeResult(raw: AgentRawResult): Outcome<AgentResult> {
    const { success, href, objective_outcome } = raw;
    let outcomes: Outcome<LLMContent> | undefined = undefined;
    let intermediate: Outcome<FileData[]> | undefined = undefined;
    if (success) {
      outcomes = this.translator.fromPidginString(objective_outcome);
      if (!ok(outcomes)) return outcomes;
      const intermediateFiles = [...this.fileSystem.files.keys()];
      const errors: string[] = [];
      intermediate = intermediateFiles.flatMap((file) => {
        const content = this.translator.fromPidginFiles([file]);
        if (!ok(content)) {
          errors.push(content.$error);
          return [];
        }
        return { path: file, content };
      });
      if (errors.length > 0) {
        return err(errors.join(","));
      }
    }
    return { success, href, outcomes, intermediate };
  }
}
