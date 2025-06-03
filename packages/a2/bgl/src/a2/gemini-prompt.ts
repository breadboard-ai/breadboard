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
import { StreamableReporter } from "./output";

export { GeminiPrompt };

type FunctionResponsePart = {
  functionResponse: {
    name: string;
    response: object;
  };
};

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
    const reporter = new StreamableReporter({
      title: `Calling ${this.inputs.model}`,
      icon: "spark",
    });
    try {
      this.calledTools = false;
      this.calledCustomTools = false;
      const { allowToolErrors, validator } = this.options;
      await reporter.start();
      await reporter.report(this.inputs.body as JsonSerializable);
      const invoking = await gemini(this.inputs);
      if (!ok(invoking)) return reporter.reportError(invoking);
      if ("context" in invoking) {
        return reporter.reportError(
          err("Invalid output from Gemini -- must be candidates")
        );
      }
      const candidate = invoking.candidates.at(0);
      const content = candidate?.content;
      if (!content) return reporter.reportError(err("No content from Gemini"));
      if (!content.parts) {
        return reporter.reportError(
          err(
            `Gemini failed to generate result due to ${candidate.finishReason}`
          )
        );
      }
      reporter.reportLLMContent(content);
      reporter.close();
      const results: LLMContent[][] = [];
      const errors: string[] = [];
      if (validator) {
        const validating = validator(content);
        if (!ok(validating)) return validating;
      }
      await this.options.toolManager?.processResponse(
        content,
        async ($board, args, passContext, functionName) => {
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
          } else if (functionName === undefined) {
            errors.push(`No function name for ${JSON.stringify(callingTool)}`);
          } else {
            if (passContext) {
              if (!("context" in callingTool)) {
                errors.push(`No "context" port in outputs of "${$board}"`);
              } else {
                const response = {
                  ["value"]: JSON.stringify(
                    callingTool.context as LLMContent[]
                  ),
                };
                const responsePart: FunctionResponsePart = {
                  functionResponse: {
                    name: functionName,
                    response: response,
                  },
                };
                const toolResponseContent: LLMContent = {
                  role: "user",
                  parts: [responsePart],
                };
                results.push([toolResponseContent]);
                console.log(
                  "gemini-prompt + passContext, processResponse: ",
                  results
                );
              }
            } else {
              const responsePart: FunctionResponsePart = {
                functionResponse: {
                  name: functionName,
                  response: callingTool,
                },
              };
              const toolResponseContent: LLMContent = {
                role: "user",
                parts: [responsePart],
              };
              console.log("toolResponseContent: ", toolResponseContent);
              results.push([toolResponseContent]);
              console.log("gemini-prompt processResponse: ", results);
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
        this.inputs.body.generationConfig?.responseMimeType ==
        "application/json";
      console.log("gemini-prompt before : ", content);
      const result = isJSON ? [textToJson(content)] : [content];
      if (results.length) {
        result.push(mergeLastParts(results));
      }
      console.log("gemini-prompt pushed mergeLastParts: ", result);
      return { all: result, last: result.at(-1)!, candidate };
    } finally {
      // In case we exited early, close the reporter anyway.
      reporter.close();
    }
  }
}
