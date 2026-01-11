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
import { AgentFileSystem } from "./file-system.js";
import { FunctionCallerImpl } from "./function-caller.js";
import { getGenerateFunctionGroup } from "./functions/generate.js";
import {
  CREATE_TASK_TREE_SCRATCHPAD_FUNCTION,
  getSystemFunctionGroup,
  FAILED_TO_FULFILL_FUNCTION,
  OBJECTIVE_FULFILLED_FUNCTION,
} from "./functions/system.js";
import { PidginTranslator } from "./pidgin-translator.js";
import { AgentUI } from "./ui.js";
import { getMemoryFunctionGroup } from "./functions/memory.js";
import { SheetManager } from "../google-drive/sheet-manager.js";
import { memorySheetGetter } from "../google-drive/memory-sheet-getter.js";
import { FunctionGroup, UIType } from "./types.js";
import { getChatFunctionGroup } from "./functions/chat.js";
import { getA2UIFunctionGroup } from "./functions/a2ui.js";
import { getNoUiFunctionGroup } from "./functions/no-ui.js";

export { Loop };

export type AgentRunArgs = {
  objective: LLMContent;
  params: Params;
  uiType?: UIType;
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
  extra: (string | undefined)[];
};

const AGENT_MODEL = "gemini-3-flash-preview";

function createSystemInstruction(args: SystemInstructionArgs) {
  return llm`
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

Here are the additional agent instructions for you. These will make your life a lot easier. Pay attention to them.

<additional-agent-instructions>

${args.extra.filter((instruction) => instruction !== undefined).join("\n\n")}

</additional-agent-instructions>

`.asContent();
}

/**
 * The main agent loop
 */
class Loop {
  private readonly translator: PidginTranslator;
  private readonly fileSystem: AgentFileSystem;
  private readonly ui: AgentUI;
  private readonly memoryManager: SheetManager;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs
  ) {
    this.memoryManager = new SheetManager(
      moduleArgs,
      memorySheetGetter(moduleArgs)
    );
    this.fileSystem = new AgentFileSystem(this.memoryManager);
    this.translator = new PidginTranslator(caps, moduleArgs, this.fileSystem);
    this.ui = new AgentUI(caps, moduleArgs, this.translator);
  }

  async run({
    objective,
    params,
    uiPrompt,
    uiType = "none",
  }: AgentRunArgs): Promise<Outcome<AgentResult>> {
    const { caps, moduleArgs, fileSystem, translator, ui, memoryManager } =
      this;

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

      const functionGroups: FunctionGroup[] = [];

      functionGroups.push(
        getSystemFunctionGroup({
          fileSystem,
          translator,
          failureCallback: (objective_outcome: string) => {
            terminateLoop = true;
            result = {
              success: false,
              href: "/",
              objective_outcome,
            };
          },
          successCallback: (href, objective_outcome) => {
            const originalRoute = fileSystem.getOriginalRoute(href);
            if (!ok(originalRoute)) return originalRoute;

            terminateLoop = true;
            console.log("SUCCESS! Objective fulfilled");
            console.log("Transfer control to", originalRoute);
            console.log("Objective outcomes:", objective_outcome);
            result = {
              success: true,
              href: originalRoute,
              objective_outcome,
            };
          },
        })
      );

      functionGroups.push(
        getGenerateFunctionGroup({
          fileSystem,
          caps,
          moduleArgs,
          translator,
        })
      );
      functionGroups.push(
        getMemoryFunctionGroup({
          translator,
          fileSystem,
          memoryManager,
        })
      );

      if (uiType === "a2ui") {
        const a2uiFunctionGroup = await getA2UIFunctionGroup({
          caps,
          moduleArgs,
          fileSystem,
          translator,
          ui,
          uiPrompt,
          objective,
          params,
        });
        if (!ok(a2uiFunctionGroup)) return a2uiFunctionGroup;
        functionGroups.push(a2uiFunctionGroup);
      } else if (uiType === "chat") {
        functionGroups.push(
          getChatFunctionGroup({ chatManager: ui, translator })
        );
      } else {
        functionGroups.push(getNoUiFunctionGroup());
      }

      const objectiveTools = objectivePidgin.tools.list().at(0);
      const tools: Tool[] = [
        {
          ...objectiveTools,
          functionDeclarations: [
            ...(objectiveTools?.functionDeclarations || []),
            ...functionGroups.flatMap((group) => group.declarations),
          ],
        },
      ];
      const functionDefinitionMap = new Map([
        ...functionGroups.flatMap((group) => group.definitions),
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
            extra: functionGroups.flatMap((group) => group.instruction),
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

  async #finalizeResult(raw: AgentRawResult): Promise<Outcome<AgentResult>> {
    const { success, href, objective_outcome } = raw;
    if (!success) {
      return err(objective_outcome);
    }
    const outcomes = await this.translator.fromPidginString(objective_outcome);
    if (!ok(outcomes)) return outcomes;
    const intermediateFiles = [...this.fileSystem.files.keys()];
    const errors: string[] = [];
    const intermediate = (
      await Promise.all(
        intermediateFiles.map(async (file) => {
          const content = await this.translator.fromPidginFiles([file]);
          if (!ok(content)) {
            errors.push(content.$error);
            return [];
          }
          return { path: file, content };
        })
      )
    ).flat();
    if (errors.length > 0) {
      return err(errors.join(","));
    }
    return { success, href, outcomes, intermediate };
  }
}
