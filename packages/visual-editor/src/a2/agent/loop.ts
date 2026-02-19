/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import {
  conformGeminiBody,
  GeminiBody,
  streamGenerateContent,
  Tool,
} from "../a2/gemini.js";
import { llm } from "../a2/utils.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { SimplifiedToolManager } from "../a2/tool-manager.js";
import { FunctionCallerImpl } from "./function-caller.js";
import { FunctionGroup, LoopHooks } from "./types.js";

export { Loop, LoopController };
export type { AgentRunArgs, AgentResult, FileData };

type AgentRunArgs = {
  objective: LLMContent;
  /**
   * Pre-built function groups for this run.
   * The caller is responsible for creating and configuring these.
   */
  functionGroups: FunctionGroup[];
  /**
   * Optional lifecycle hooks the Loop invokes at key points.
   */
  hooks?: LoopHooks;
  /**
   * Initial contents for the conversation. If resuming, this may
   * include historical turns. If not provided, defaults to
   * [objectiveContent].
   */
  contents?: LLMContent[];
  /**
   * Custom tool manager for user-defined tools (e.g. board-tools wired
   * in the objective via pidgin). If not provided, no custom tool
   * dispatch is available.
   */
  customTools?: SimplifiedToolManager;
};

type AgentResult = {
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

type FileData = {
  path: string;
  content: LLMContent;
};

const AGENT_MODEL = "gemini-3-flash-preview";

const EMPTY_TOOL_MANAGER: SimplifiedToolManager = {
  callTool: () => Promise.resolve(err("No custom tools available")),
  list: () => [],
};

/**
 * Controls the Loop's termination from outside.
 *
 * Function groups (e.g. `declare_success`, `declare_failure`) call
 * `terminate(result)` to stop the loop and set its final result.
 * Mirrors the `AbortController` / `AbortSignal` pattern.
 */
class LoopController {
  #terminated = false;
  #result: Outcome<AgentResult> | null = null;

  get terminated(): boolean {
    return this.#terminated;
  }

  get result(): Outcome<AgentResult> {
    if (!this.#result) {
      throw new Error("LoopController.result accessed before termination");
    }
    return this.#result;
  }

  terminate(result: Outcome<AgentResult>): void {
    this.#terminated = true;
    this.#result = result;
  }
}

/**
 * The main agent loop.
 *
 * A pure Gemini function-calling orchestrator. It does not create or own
 * any external dependencies (file systems, translators, progress managers,
 * run state trackers). Instead, callers provide:
 *
 * - **functionGroups**: the tools the agent can call
 * - **hooks**: optional lifecycle callbacks for progress, state tracking, etc.
 *
 * This makes the Loop reusable across different agent types:
 * - Content generation agent (full hooks for progress + run state)
 * - Graph editing agent (minimal or no hooks)
 * - Headless eval agent (run-state hooks only)
 */
class Loop {
  readonly controller = new LoopController();

  constructor(private readonly moduleArgs: A2ModuleArgs) {}

  async run({
    objective,
    functionGroups,
    hooks = {},
    contents: initialContents,
    customTools,
  }: AgentRunArgs): Promise<Outcome<AgentResult>> {
    const { moduleArgs } = this;
    const contents = initialContents || [objective];
    const toolManager = customTools || EMPTY_TOOL_MANAGER;

    hooks.onStart?.(objective);

    try {
      const customToolDeclarations = toolManager.list();
      const tools: Tool[] = [
        {
          ...customToolDeclarations[0],
          functionDeclarations: [
            ...(customToolDeclarations[0]?.functionDeclarations || []),
            ...functionGroups.flatMap((group) => group.declarations),
          ],
        },
      ];

      const functionDefinitionMap = new Map([
        ...functionGroups.flatMap((group) => group.definitions),
      ]);

      while (!this.controller.terminated) {
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
          return conformedBody;
        }

        hooks.onSendRequest?.(AGENT_MODEL, conformedBody);

        const generated = await streamGenerateContent(
          AGENT_MODEL,
          conformedBody,
          moduleArgs
        );
        if (!ok(generated)) {
          return generated;
        }
        const functionCaller = new FunctionCallerImpl(
          functionDefinitionMap,
          toolManager
        );
        for await (const chunk of generated) {
          const content = chunk.candidates?.at(0)?.content;
          if (!content) {
            return err(
              `Agent unable to proceed: no content in Gemini response`
            );
          }
          contents.push(content);
          hooks.onContent?.(content);
          const parts = content.parts || [];
          for (const part of parts) {
            if (part.thought) {
              if ("text" in part) {
                hooks.onThought?.(part.text);
              } else {
                console.log("INVALID THOUGHT", part);
              }
            }
            if ("functionCall" in part) {
              const functionDef = functionDefinitionMap.get(
                part.functionCall.name
              );

              // If hooks provide onFunctionCall, use it for callId + reporter.
              // Otherwise, generate a simple callId.
              const { callId, reporter } = hooks.onFunctionCall
                ? hooks.onFunctionCall(
                    part,
                    typeof functionDef?.icon === "string"
                      ? functionDef.icon
                      : undefined,
                    functionDef?.title
                  )
                : { callId: crypto.randomUUID(), reporter: null };

              functionCaller.call(
                callId,
                part,
                (status, opts) =>
                  hooks.onFunctionCallUpdate?.(callId, status, opts),
                reporter
              );
            }
          }
        }
        const functionResults = await functionCaller.getResults();
        if (!functionResults) continue;
        if (!ok(functionResults)) {
          return err(`Agent unable to proceed: ${functionResults.$error}`);
        }
        // Report each function result individually
        for (const { callId, response } of functionResults.results) {
          hooks.onFunctionResult?.(callId, { parts: [response] });
        }
        contents.push(functionResults.combined);
        hooks.onContent?.(functionResults.combined);
        hooks.onTurnComplete?.();
      }
      return this.controller.result;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return err(`Agent error: ${errorMessage}`);
    } finally {
      hooks.onFinish?.();
    }
  }
}
