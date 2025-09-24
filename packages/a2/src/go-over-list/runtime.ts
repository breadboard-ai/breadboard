/**
 * @fileoverview The runtime that powers going over the list.
 */

import {
  Capabilities,
  DataPart,
  LLMContent,
  Outcome,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import { GeminiPrompt } from "../a2/gemini-prompt";
import { ToolManager } from "../a2/tool-manager";
import { ok, toLLMContent } from "../a2/utils";
import { defaultSystemInstruction } from "./system-instruction";
import { type ExecuteStepFunction, type Strategist, type Task } from "./types";

export { generateId, Runtime };

function generateId() {
  return Math.random().toString(36).substring(2, 5);
}

class Runtime {
  readonly context: LLMContent[];
  readonly errors: string[] = [];
  readonly execute: ExecuteStepFunction;

  constructor(
    private readonly caps: Capabilities,
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
      this.caps,
      this.execute,
      this.context,
      objective,
      this.makeList
    );
  }

  async #execute(item: Task): Promise<LLMContent | undefined> {
    const { toolManager, context, errors } = this;
    const prompt = toLLMContent(item.task);
    let contents;
    let toolConfig = {};
    if (!toolManager.hasTools()) {
      contents = [...context, prompt];
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
    const geminiPrompt = new GeminiPrompt(
      this.caps,
      {
        body: {
          contents,
          tools: toolManager.list(),
          ...toolConfig,
        },
        systemInstruction: defaultSystemInstruction(),
      },
      {
        toolManager,
        allowToolErrors: true,
      }
    );
    const executing = await geminiPrompt.invoke();
    if (!ok(executing)) {
      errors.push(executing.$error);
      return;
    }
    // gross hack. TODO: Instead, teach GeminiPrompt to do compositional
    // function calling.
    if (geminiPrompt.calledTools) {
      return grossHackTransformFunctionResponses(executing.last);
    }
    return executing.last;
  }
}

function grossHackTransformFunctionResponses(responses: LLMContent) {
  const parts = responses.parts.map<DataPart>((part) => {
    if ("functionResponse" in part) {
      return {
        text: JSON.stringify(part.functionResponse.response),
      } as TextCapabilityPart;
    }
    return part;
  });
  return { parts, role: responses.role || "user" };
}
