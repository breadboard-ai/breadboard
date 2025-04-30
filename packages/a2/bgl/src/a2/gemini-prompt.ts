/**
 * @fileoverview Manages Gemini prompt.
 */

import invokeBoard from "@invoke";

import gemini, {
  type GeminiInputs,
  type GeminiOutputs,
  type Candidate,
} from "./gemini";
import { ToolManager } from "./tool-manager";
import { ok, err, toLLMContent, addUserTurn } from "./utils";

export { GeminiPrompt };

function textToJson(content: LLMContent): LLMContent {
  return {
    ...content,
    parts: content.parts.map((part) => {
      if ("text" in part) {
        try {
          return { json: JSON.parse(part.text) };
        } catch (e) {
          // fall through.
        }
      }
      return part;
    }),
  };
}

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

  calledTools: boolean = false;
  // Useful for detecting if subgraphs were invoked, based on whether a tool was invoked with
  // 'passContext' set to true.
  calledCustomTools: boolean = false;

  constructor(
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
    let contextArg = hasContext
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
    const invoking = await gemini(this.inputs);
    if (!ok(invoking)) return invoking;
    if ("context" in invoking) {
      return err("Invalid output from Gemini -- must be candidates");
    }
    const candidate = invoking.candidates.at(0);
    const content = candidate?.content;
    if (!content) {
      return err("No content from Gemini");
    }
    if (!content.parts) {
      return err(
        `Gemini failed to generate result due to ${candidate.finishReason}`
      );
    }
    const results: LLMContent[][] = [];
    const errors: string[] = [];
    if (validator) {
      const validating = validator(content);
      if (!ok(validating)) return validating;
    }
    await this.options.toolManager?.processResponse(
      content,
      async ($board, args, passContext) => {
        console.log("CALLING TOOL", $board, args, passContext);
        this.calledTools = true;
        if (passContext) {
          // Passing context means we called a subgraph/'custom tool'.
          this.calledCustomTools = true;
        }
        const callingTool = await invokeBoard({
          $board,
          ...this.#normalizeArgs(args, passContext),
        });
        if ("$error" in callingTool) {
          errors.push(JSON.stringify(callingTool.$error));
        } else {
          if (passContext) {
            if (!("context" in callingTool)) {
              errors.push(`No "context" port in outputs of "${$board}"`);
            } else {
              results.push(callingTool.context as LLMContent[]);
            }
          } else {
            results.push([toLLMContent(JSON.stringify(callingTool))]);
          }
        }
      }
    );
    console.log("ERRORS", errors);
    if (errors.length && !allowToolErrors) {
      return err(
        `Calling tools generated the following errors: ${errors.join(",")}`
      );
    }
    const isJSON =
      this.inputs.body.generationConfig?.responseMimeType == "application/json";
    const result = isJSON ? [textToJson(content)] : [content];
    if (results.length) {
      result.push(mergeLastParts(results));
    }
    return { all: result, last: result.at(-1)!, candidate };
  }
}
