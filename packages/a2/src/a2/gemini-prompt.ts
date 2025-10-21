/**
 * @fileoverview Manages Gemini prompt.
 */

import {
  Capabilities,
  DataPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import gemini, { type Candidate, type GeminiInputs } from "./gemini";
import { ToolManager } from "./tool-manager";
import { addUserTurn, err, ok } from "./utils";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";

export { GeminiPrompt };

function mergeLastParts(contexts: LLMContent[][]): LLMContent {
  const parts: DataPart[] = [];
  for (const context of contexts) {
    const last = context.at(-1);
    if (!last) continue;
    if (!last.parts) continue;
    parts.push(...last.parts);
  }
  return {
    parts,
    role: "user",
  };
}

export type ValidatorFunction = (response: LLMContent) => Outcome<void>;

export type GeminiPromptOutput = {
  last: LLMContent;
  all: LLMContent[];
  candidate: Candidate;
};

export type GeminiPromptInvokeOptions = GeminiPromptOptions;

export type GeminiPromptOptions = {
  allowToolErrors?: boolean;
  validator?: ValidatorFunction;
  toolManager?: ToolManager;
};
class GeminiPrompt {
  readonly options: GeminiPromptOptions;

  /**
   * A flag that is set by tools when they indicate that the output of these
   * tools will replace whatever Gemini produces.
   */
  saveOutputs: boolean = false;
  calledTools: boolean = false;
  // Useful for detecting if subgraphs were invoked, based on whether a tool was invoked with
  // 'passContext' set to true.
  calledCustomTools: boolean = false;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleFactoryArgs,
    public readonly inputs: GeminiInputs,
    options?: ToolManager | GeminiPromptOptions
  ) {
    this.options = this.#reconcileOptions(options);
  }

  #reconcileOptions(
    options?: ToolManager | GeminiPromptOptions
  ): GeminiPromptOptions {
    if (!options) return {};
    if (options instanceof ToolManager) {
      return { toolManager: options };
    }
    return options;
  }

  #normalizeArgs(a: object, passContext?: boolean) {
    if (!passContext) return a;
    const args = a as Record<string, unknown>;
    const context = [...this.inputs.body.contents];
    const hasContext = "context" in args;
    const contextArg = hasContext
      ? {}
      : {
          context,
        };
    return {
      ...contextArg,
      ...Object.fromEntries(
        Object.entries(args).map(([name, value]) => {
          if (hasContext) {
            value = addUserTurn(value as string, [
              ...this.inputs.body.contents,
            ]);
          }
          return [name, value];
        })
      ),
    };
  }

  async invoke(): Promise<Outcome<GeminiPromptOutput>> {
    this.calledTools = false;
    this.calledCustomTools = false;
    const { allowToolErrors, validator } = this.options;
    const invoking = await gemini(this.inputs, this.caps, this.moduleArgs);
    if (!ok(invoking)) return invoking;
    if ("context" in invoking) {
      return err("Invalid output from Gemini -- must be candidates", {
        origin: "server",
        kind: "bug",
      });
    }
    const candidate = invoking.candidates.at(0);
    const content = candidate?.content;
    if (!content)
      return err("No content from Gemini", {
        origin: "server",
        kind: "bug",
      });
    if (!content.parts) {
      return err(
        `Gemini failed to generate result due to ${candidate.finishReason}`
      );
    }
    if (validator) {
      const validating = validator(content);
      if (!ok(validating)) return validating;
    }
    const callingTools = await this.options.toolManager?.callTools(
      content,
      !!allowToolErrors,
      this.inputs.body.contents
    );
    if (!ok(callingTools)) return callingTools;

    const {
      results = [],
      calledTools,
      calledCustomTools,
      saveOutputs,
    } = callingTools || {};

    if (calledTools) this.calledTools = true;
    if (calledCustomTools) this.calledCustomTools = true;
    if (saveOutputs) this.saveOutputs = true;

    const result = [content];
    if (results.length) {
      result.push(mergeLastParts(results));
    }
    return { all: result, last: result.at(-1)!, candidate };
  }
}
