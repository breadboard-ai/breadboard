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
import { getSystemFunctionGroup } from "./functions/system.js";
import { PidginTranslator } from "./pidgin-translator.js";
import { AgentUI } from "./ui.js";
import { getMemoryFunctionGroup } from "./functions/memory.js";
import { SheetManager } from "../google-drive/sheet-manager.js";
import { memorySheetGetter } from "../google-drive/memory-sheet-getter.js";
import { FunctionGroup, UIType } from "./types.js";
import { CHAT_LOG_VFS_PATH, getChatFunctionGroup } from "./functions/chat.js";
import { getA2UIFunctionGroup } from "./functions/a2ui.js";
import { getNoUiFunctionGroup } from "./functions/no-ui.js";

export { Loop };

export type AgentRunArgs = {
  objective: LLMContent;
  params: Params;
  uiType?: UIType;
  uiPrompt?: LLMContent;
  extraInstruction?: string;
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

const AGENT_MODEL = "gemini-3-flash-preview";

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
    this.fileSystem = new AgentFileSystem({
      memoryManager: this.memoryManager,
    });
    this.translator = new PidginTranslator(caps, moduleArgs, this.fileSystem);
    this.ui = new AgentUI(caps, moduleArgs, this.translator);
  }

  async run({
    objective,
    params,
    uiPrompt,
    uiType = "none",
    extraInstruction = "",
  }: AgentRunArgs): Promise<Outcome<AgentResult>> {
    const { caps, moduleArgs, fileSystem, translator, ui, memoryManager } =
      this;

    ui.progress.startAgent(objective);
    try {
      const objectivePidgin = await translator.toPidgin(objective, params);
      if (!ok(objectivePidgin)) return objectivePidgin;

      if (extraInstruction) {
        extraInstruction = `${extraInstruction}\n\n`;
      }

      const contents: LLMContent[] = [
        llm`<objective>${extraInstruction}${objectivePidgin.text}</objective>`.asContent(),
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
        fileSystem.addSystemFile(CHAT_LOG_VFS_PATH, () =>
          JSON.stringify(ui.chatLog)
        );
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
