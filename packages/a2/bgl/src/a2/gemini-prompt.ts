/**
 * @fileoverview Manages Gemini prompt.
 */

import invokeBoard from "@invoke";

import gemini, { type Candidate, type GeminiInputs } from "./gemini";
import { ToolManager } from "./tool-manager";
import { addUserTurn, err, ok } from "./utils";

export { GeminiPrompt };

type FunctionResponsePart = {
  functionResponse: {
    name: string;
    response: object;
  };
};

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
    private readonly caps: Capabilities,
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
    const invoking = await gemini(this.inputs, this.caps);
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
                ["value"]: JSON.stringify(callingTool.context as LLMContent[]),
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
    const result = [content];
    if (results.length) {
      result.push(mergeLastParts(results));
    }
    return { all: result, last: result.at(-1)!, candidate };
  }
}
