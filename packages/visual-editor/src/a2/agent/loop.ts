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
import { callGeminiImage } from "../a2/image-utils.js";
import { callAudioGen } from "../audio-generator/main.js";
import { callMusicGen } from "../music-generator/main.js";
import { callVideoGen } from "../video-generator/main.js";
import { llm } from "../a2/utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { AgentFileSystem } from "./file-system.js";
import { FunctionCallerImpl } from "./function-caller.js";
import {
  getGenerateFunctionGroup,
  ModelConstraint,
} from "./functions/generate.js";
import { getSystemFunctionGroup } from "./functions/system.js";
import { PidginTranslator } from "./pidgin-translator.js";
import { AgentUI } from "./ui.js";
import { getMemoryFunctionGroup } from "./functions/memory.js";
import { FunctionGroup, MemoryManager, UIType } from "./types.js";
import { CHAT_LOG_PATH, getChatFunctionGroup } from "./functions/chat.js";
import { getA2UIFunctionGroup } from "./functions/a2ui.js";
import { getNoUiFunctionGroup } from "./functions/no-ui.js";
import { getGoogleDriveFunctionGroup } from "./functions/google-drive.js";
import { TaskTreeManager } from "./task-tree-manager.js";
import { RunStateManager } from "./run-state-manager.js";
import { Generators } from "./types.js";

export { Loop };

const generators: Generators = {
  streamContent: streamGenerateContent,
  conformBody: conformGeminiBody,
  callImage: callGeminiImage,
  callVideo: callVideoGen,
  callAudio: callAudioGen,
  callMusic: callMusicGen,
};

export type AgentRunArgs = {
  objective: LLMContent;
  params: Params;
  uiType?: UIType;
  uiPrompt?: LLMContent;
  extraInstruction?: string;
  modelConstraint?: ModelConstraint;
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

const AGENT_MODEL = "gemini-3-flash-preview";

/**
 * The main agent loop
 */
class Loop {
  private readonly translator: PidginTranslator;
  private readonly fileSystem: AgentFileSystem;
  private readonly ui: AgentUI;
  private readonly memoryManager: MemoryManager;
  private readonly taskTreeManager: TaskTreeManager;
  private readonly runStateManager: RunStateManager;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs
  ) {
    this.memoryManager = moduleArgs.agentContext.memoryManager;
    this.fileSystem = new AgentFileSystem({
      context: moduleArgs.context,
      memoryManager: this.memoryManager,
    });
    this.translator = new PidginTranslator(caps, moduleArgs, this.fileSystem);
    this.ui = new AgentUI(caps, moduleArgs, this.translator);
    this.taskTreeManager = new TaskTreeManager(this.fileSystem);
    this.runStateManager = new RunStateManager(
      moduleArgs.agentContext,
      this.fileSystem
    );
  }

  async run({
    objective,
    params,
    uiPrompt,
    uiType = "chat",
    extraInstruction = "",
    modelConstraint = "none",
  }: AgentRunArgs): Promise<Outcome<AgentResult>> {
    const {
      caps,
      moduleArgs,
      fileSystem,
      translator,
      ui,
      memoryManager,
      taskTreeManager,
    } = this;

    ui.progress.startAgent(objective);
    try {
      const objectivePidgin = await translator.toPidgin(
        objective,
        params,
        true
      );
      if (!ok(objectivePidgin)) return objectivePidgin;

      // Set whether memory files should be exposed based on useMemory tool
      fileSystem.setUseMemory(objectivePidgin.useMemory);

      if (extraInstruction) {
        extraInstruction = `${extraInstruction}\n\n`;
      }

      // Start or resume the run via RunStateManager
      const stepId = this.moduleArgs.context.currentStep?.id;
      const objectiveContent =
        llm`<objective>${extraInstruction}${objectivePidgin.text}</objective>`.asContent();

      // Check the enableResumeAgentRun flag
      const runtimeFlags = await moduleArgs.context.flags?.flags();
      const enableResumeAgentRun = runtimeFlags?.enableResumeAgentRun ?? false;

      const { contents } = enableResumeAgentRun
        ? this.runStateManager.startOrResume(stepId, objectiveContent)
        : this.runStateManager.startFresh(stepId, objectiveContent);

      let terminateLoop = false;
      let finalResult: Outcome<AgentResult> | null = null;

      const functionGroups: FunctionGroup[] = [];

      functionGroups.push(
        getSystemFunctionGroup({
          fileSystem,
          translator,
          taskTreeManager,
          failureCallback: (objective_outcome: string) => {
            terminateLoop = true;
            finalResult = this.runStateManager.fail(err(objective_outcome));
          },
          successCallback: async (href, objective_outcome) => {
            const originalRoute = fileSystem.getOriginalRoute(href);
            if (!ok(originalRoute)) return originalRoute;

            const outcomes =
              await translator.fromPidginString(objective_outcome);
            if (!ok(outcomes)) return outcomes;

            const intermediateFiles = [...fileSystem.files.keys()];
            const errors: string[] = [];
            const intermediate = (
              await Promise.all(
                intermediateFiles.map(async (file) => {
                  const content = await translator.fromPidginFiles([file]);
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

            this.runStateManager.complete();
            terminateLoop = true;
            finalResult = {
              success: true,
              href: originalRoute,
              outcomes,
              intermediate,
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
          modelConstraint,
          taskTreeManager,
          generators,
        })
      );
      if (objectivePidgin.useMemory) {
        functionGroups.push(
          getMemoryFunctionGroup({
            context: moduleArgs.context,
            translator,
            fileSystem,
            memoryManager,
            taskTreeManager,
          })
        );
      }

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
        fileSystem.addSystemFile(CHAT_LOG_PATH, () =>
          JSON.stringify(ui.chatLog)
        );
        functionGroups.push(
          getChatFunctionGroup({ chatManager: ui, translator, taskTreeManager })
        );
      } else {
        functionGroups.push(getNoUiFunctionGroup());
      }

      const enableGoogleDriveTools = await moduleArgs.context.flags?.flags();
      if (enableGoogleDriveTools) {
        functionGroups.push(
          getGoogleDriveFunctionGroup({ fileSystem, moduleArgs })
        );
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
          systemInstruction: llm`${functionGroups
            .flatMap((group) => group.instruction)
            .filter((instruction) => instruction !== undefined)
            .join("\n\n")}`.asContent(),
          toolConfig: {
            functionCallingConfig: { mode: "ANY" },
          },
          tools,
        };
        const conformedBody = await conformGeminiBody(moduleArgs, body);
        if (!ok(conformedBody)) {
          return this.runStateManager.fail(conformedBody);
        }

        ui.progress.sendRequest(AGENT_MODEL, conformedBody);

        // Capture the request body for the first request only
        this.runStateManager.captureRequestBody(AGENT_MODEL, conformedBody);

        const generated = await streamGenerateContent(
          AGENT_MODEL,
          conformedBody,
          moduleArgs
        );
        if (!ok(generated)) {
          return this.runStateManager.fail(generated);
        }
        const functionCaller = new FunctionCallerImpl(
          functionDefinitionMap,
          objectivePidgin.tools
        );
        for await (const chunk of generated) {
          const content = chunk.candidates?.at(0)?.content;
          if (!content) {
            return this.runStateManager.fail(
              err(`Agent unable to proceed: no content in Gemini response`)
            );
          }
          contents.push(content);
          this.runStateManager.pushContent(content);
          const parts = content.parts || [];
          for (const part of parts) {
            if (part.thought) {
              if ("text" in part) {
                ui.progress.thought(part.text);
              } else {
                console.log("INVALID THOUGHT", part);
              }
            }
            if ("functionCall" in part) {
              const functionDef = functionDefinitionMap.get(
                part.functionCall.name
              );
              const { callId, reporter } = ui.progress.functionCall(
                part,
                functionDef?.icon,
                functionDef?.title
              );
              functionCaller.call(
                callId,
                part,
                (status, opts) =>
                  ui.progress.functionCallUpdate(callId, status, opts),
                reporter
              );
            }
          }
        }
        const functionResults = await functionCaller.getResults();
        if (!functionResults) continue;
        if (!ok(functionResults)) {
          return this.runStateManager.fail(
            err(`Agent unable to proceed: ${functionResults.$error}`)
          );
        }
        // Report each function result individually
        for (const { callId, response } of functionResults.results) {
          ui.progress.functionResult(callId, { parts: [response] });
        }
        contents.push(functionResults.combined);
        this.runStateManager.pushContent(functionResults.combined);
        this.runStateManager.completeTurn();
      }
      return finalResult!;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return this.runStateManager.fail(err(`Agent error: ${errorMessage}`));
    } finally {
      ui.finish();
    }
  }
}
