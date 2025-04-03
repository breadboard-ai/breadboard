/**
 * @fileoverview The runtime that powers going over the list.
 */

import { ToolManager } from "./a2/tool-manager";
import { StructuredResponse } from "./a2/structured-response";
import { ok, err, toLLMContent } from "./a2/utils";
import { GeminiPrompt } from "./a2/gemini-prompt";
import {
  type ExecuteStepFunction,
  type Plan,
  type Task,
  type Strategist,
} from "./types";

export { Runtime, generateId };

function generateId() {
  return Math.random().toString(36).substring(2, 5);
}

class Runtime {
  readonly context: LLMContent[];
  readonly errors: string[] = [];
  readonly execute: ExecuteStepFunction;

  constructor(
    context: LLMContent[] | undefined,
    public readonly toolManager: ToolManager,
    public readonly makeList: boolean
  ) {
    this.context = context ? [...context] : [];
    this.execute = this.#execute.bind(this);
  }

  async executeStrategy(
    objective: LLMContent,
    strategist: Strategist
  ): Promise<Outcome<LLMContent[]>> {
    return strategist.execute(
      this.execute,
      this.context,
      objective,
      this.makeList
    );
  }

  async #execute(item: Task): Promise<LLMContent | undefined> {
    const { toolManager, context, errors } = this;
    let structuredResponse: StructuredResponse | undefined;
    const prompt = toLLMContent(item.task);
    let contents;
    let toolConfig = {};
    if (!toolManager.hasTools()) {
      structuredResponse = new StructuredResponse(generateId(), false);
      contents = structuredResponse.addPrompt(context, prompt);
    } else {
      toolConfig = {
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
          },
        },
      };
      contents = [...context, toLLMContent(item.task)];
    }
    const executing = await new GeminiPrompt(
      {
        body: {
          contents,
          tools: toolManager.list(),
          ...toolConfig,
        },
        systemInstruction: structuredResponse?.instruction(),
      },
      {
        toolManager,
        allowToolErrors: true,
        validator: (content) => {
          return structuredResponse?.parseContent(content);
        },
      }
    ).invoke();
    if (!ok(executing)) {
      errors.push(executing.$error);
      return;
    }
    return structuredResponse
      ? toLLMContent(structuredResponse.body, "model")
      : executing.last;
  }
}
