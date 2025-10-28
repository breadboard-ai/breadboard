/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { Params } from "../a2/common";
import gemini, {
  FunctionDeclaration,
  GeminiAPIOutputs,
  GeminiInputs,
  Tool,
} from "../a2/gemini";
import { llm } from "../a2/utils";
import { A2ModuleArgs } from "../runnable-module-factory";
import { AgentFileSystem } from "./file-system";
import { FunctionCaller } from "./function-caller";
import { FunctionDefinition } from "./function-definition";
import { initializeSystemFunctions } from "./functions/system";
import { PidginTranslator } from "./pidgin-translator";
import { AgentUI } from "./ui";
import { initializeGenerateFunctions } from "./functions/generate";
import { prompt as a2UIPrompt } from "./a2ui/prompt";

export { Loop };

export type AgentRawResult = {
  success: boolean;
  user_message: string;
  href: string;
  objective_outcomes: string[];
};

export type AgentResult = {
  /**
   * Whether or not agent succeeded in fulfilling the objective.
   */
  success: boolean;
  /**
   * User message to display to the user
   */
  message: LLMContent;
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
  intermediate?: LLMContent;
};

const AGENT_MODEL = "gemini-pro-latest";

const systemInstruction = llm`
You are an LLM-powered AI agent. You are embedded into an application.
Your job is to fulfill the objective, specified at the start of the 
conversation context. The objective is part of the application.

You are linked with other AI agents via hyperlinks. The <a href="url">title</a>
syntax points at another agent. If the objective calls for it, you can transfer
control to this agent. To transfer control, use the url of the agent in the 
"href" parameter when calling "system_objective_fulfilled" or  
"system_failed_to_fulfill_objective" function. As a result, the outcomes will be transferred to that agent.

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

Here are the additional agent instructions for you. Please make sure to pay
attention to them.

<agent-instructions title="When to call generate_text">
When evaluating objective, make sure to determine whether calling 
"generate_text" is warranted. The key tradeoff here is latency: the 
"generate_text" will take longer to run, since it uses a larger model (Pro).

Here is the rule of thumb:

- For short responses like a chat conversation, just do the text generation
yourself. You are an LLM after all.
- For longer responses like generating a chapter of a book or a full report,
use "generate_text".

</agent-instructions>

<agent-instructions title="Using files">

The system you're working in uses the virtual file system (VFS). The VFS paths
are always prefixed with the "/vfs/". Every VFS file path will be of the form
"/vfs/[name]".

You can use the <file src="path" /> syntax to embed the outcome in the text.

</agent-instructions>

<agent-instructions title="Using projects">

Rely on projects to group work and to pass the work around. In particular, use
projects when the expected length of final output is large.

A "project" is a collection of files. Projects can be used to group files so 
that they could be referenced together. For example, you can create a project 
to collect all files relevant to the fulfilling the objective.

Projects are more like groupings rather than folders. Files that are added to 
the project still retain their original paths, but now also belong to the 
project. Same file can be part of multiple projects.

Projects can also be referenced as files and all have this VFS path structure:
"/vfs/projects/[name_of_project]". Project names use snake_case for naming.

Project file reference is equivalent to referencing all files within the project
in their insertion order. For example, if a project "blah" contains three files:
"/vfs/image1.png", "/vfs/text7.md" and "/vfs/file10.pdf", 
then  

"<file src="/vfs/projects/blah" />" 

is equivalent to:

"<file src="/vfs/image1.png" />
<file src="/vfs/text7.md" />
<file src="/vfs/file10.pdf" />"

Projects can be used to manage a growing set of files around between tasks.

Many functions will have the "project_path" parameter. Use it add the function
output directly to the project.

Pay attention to the objective. If it requires multiple files to be produced and
accumulated along the way, use the "Workarea Project" pattern:

- create a project
- add files to it as they are generated or otherwise produced.
- reference the project as a file whenever you need to pass all of those files
to the next task.

Example: let's suppose that your objective is to write a multi-chapter report based on some provided background information.

This is a great fit for the "Workarea Project" pattern, because here, you have
some initial context (provided background information) and then each chapter
is adding to that context.

Thus, a solid plan to fulfill this objective would be to:

1. create a "workarea" project (path "/vfs/projects/workarea")
2. write background information as one or more files, using "project_path" to
add them directly to the project
3. write each chapter of the report using "generate_text", supplying the
"/vfs/projects/workarea" path for both "project_path" and "context" parameters.
This way, the "generate_text" will use all files in the project as context, and
it will contribute the newly written chapter to the same project.
4. create a new "report" project (path "/vfs/projects/report")
5. add only the chapters to that project, so that the initial background
information is not part of the final output
6. call "system_objective_fulfilled" function with the "/vfs/project/report" as
the outcome.

</agent-instructions>

<agent-instructions title="Interacting with the user">
${a2UIPrompt}
</agent-instructions>

`.asContent();

/**
 * The main agent loop
 */
class Loop {
  #translator: PidginTranslator;
  #fileSystem: AgentFileSystem;
  #ui: AgentUI;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs
  ) {
    this.#fileSystem = new AgentFileSystem();
    this.#translator = new PidginTranslator(caps, moduleArgs, this.#fileSystem);
    this.#ui = new AgentUI(caps, moduleArgs, this.#translator);
  }

  async run(
    objective: LLMContent,
    params: Params
  ): Promise<Outcome<AgentResult>> {
    const objectivePidgin = await this.#translator.toPidgin(objective, params);
    if (!ok(objectivePidgin)) return objectivePidgin;

    const contents: LLMContent[] = [
      llm`<objective>${objectivePidgin.text}</objective>`.asContent(),
    ];
    let terminateLoop = false;
    let result: AgentRawResult = {
      success: false,
      user_message: "",
      href: "",
      objective_outcomes: [],
    };
    const systemFunctions = initializeSystemFunctions({
      useA2UI: true,
      ui: this.#ui,
      fileSystem: this.#fileSystem,
      terminateCallback: () => {
        terminateLoop = true;
      },
      successCallback: (user_message, href, objective_outcomes) => {
        terminateLoop = true;
        console.log("SUCCESS! Objective fulfilled");
        console.log("User message:", user_message);
        console.log("Transfer control to", href);
        console.log("Objective outcomes:", objective_outcomes);
        result = {
          success: true,
          user_message,
          href,
          objective_outcomes,
        };
      },
    });
    const systemFunctionDefinitions = new Map<string, FunctionDefinition>(
      systemFunctions.map((item) => [item.name!, item])
    );
    const systemFunctionDeclarations = systemFunctions.map(
      ({ handler: _handler, ...rest }) => rest as FunctionDeclaration
    );
    const generateFunctions = initializeGenerateFunctions({
      fileSystem: this.#fileSystem,
      caps: this.caps,
      moduleArgs: this.moduleArgs,
    });
    const generateFunctionDefinitions = new Map<string, FunctionDefinition>(
      generateFunctions.map((item) => [item.name!, item])
    );
    const generateFunctionDeclarations = generateFunctions.map(
      ({ handler: _handler, ...rest }) => rest as FunctionDeclaration
    );
    const objectiveTools = objectivePidgin.tools.list().at(0);
    const tools: Tool[] = [
      {
        ...objectiveTools,
        functionDeclarations: [
          ...(objectiveTools?.functionDeclarations || []),
          ...systemFunctionDeclarations,
          ...generateFunctionDeclarations,
        ],
      },
    ];
    while (!terminateLoop) {
      const inputs: GeminiInputs = {
        model: AGENT_MODEL,
        body: {
          contents,
          generationConfig: {
            thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
          },
          systemInstruction,
          toolConfig: {
            functionCallingConfig: { mode: "ANY" },
          },
          tools,
        },
      };
      const generated = (await gemini(
        inputs,
        this.caps,
        this.moduleArgs
      )) as Outcome<GeminiAPIOutputs>;
      if (!ok(generated)) return generated;
      const content = generated.candidates?.at(0)?.content;
      if (!content) {
        return err(`Agent unable to proceed: no content in Gemini response`);
      }
      contents.push(content);
      const functionCaller = new FunctionCaller(
        new Map([...systemFunctionDefinitions, ...generateFunctionDefinitions]),
        objectivePidgin.tools
      );
      const parts = content.parts || [];
      for (const part of parts) {
        if (part.thought) {
          if ("text" in part) {
            console.log("THOUGHT", part.text);
          } else {
            console.log("INVALID THOUGHT", part);
          }
        }
        if ("functionCall" in part) {
          functionCaller.call(part);
        }
      }
      const functionResults = await functionCaller.getResults();
      if (!functionResults) continue;
      if (!ok(functionResults)) {
        return err(`Agent unable to proceed: ${functionResults.$error}`);
      }
      contents.push(functionResults);
    }
    return this.#finalizeResult(result);
  }

  #finalizeResult(raw: AgentRawResult): Outcome<AgentResult> {
    const { success, user_message, href, objective_outcomes } = raw;
    const message = this.#translator.fromPidginString(user_message);
    if (!ok(message)) return message;
    let outcomes: Outcome<LLMContent> | undefined = undefined;
    let intermediate: Outcome<LLMContent> | undefined = undefined;
    if (success) {
      outcomes = this.#translator.fromPidginFiles(objective_outcomes);
      if (!ok(outcomes)) return outcomes;
      const intermediateFiles = [...this.#fileSystem.files.keys()];
      intermediate = this.#translator.fromPidginFiles(intermediateFiles);
      if (!ok(intermediate)) return intermediate;
    }
    return { success, message, href, outcomes, intermediate };
  }
}
