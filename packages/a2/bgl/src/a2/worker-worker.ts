/**
 * @fileoverview Performs assigned task. Part of the worker.
 */
import invokeBoard from "@invoke";
import output from "@output";

import { toText, toLLMContent, ok, err, llm, generateId } from "./utils";
import {
  type GeminiSchema,
  type GeminiInputs,
  type GeminiOutputs,
  type Tool,
  defaultSafetySettings,
  type GeminiAPIOutputs,
} from "./gemini";
import { callGemini } from "./gemini-client";
import { GeminiPrompt } from "./gemini-prompt";
import { StructuredResponse } from "./structured-response";
import { ToolManager } from "./tool-manager";
import {
  fanOutContext,
  toList,
  listPrompt,
  listSchema,
  hasLists,
} from "./lists";

export { invoke as default, describe };

type Inputs = {
  id: string;
  work: LLMContent[];
  description: LLMContent;
  model: string;
  toolManager: ToolManager;
  summarize: boolean;
  chat: boolean;
  makeList: boolean;
};

type Outputs = {
  product: LLMContent;
  response?: LLMContent;
  epilog?: string;
};

type WorkMode = "generate" | "call-tools" | "summarize";

function computeWorkMode(tools: Tool[], summarize: boolean): WorkMode {
  if (summarize) {
    return "summarize";
  }
  if (tools.length > 0) {
    return "call-tools";
  }
  return "generate";
}

async function callTools(
  inputs: Omit<GeminiInputs, "model">,
  model: string,
  tools: Tool[],
  retries: number
): Promise<LLMContent> {
  inputs.body.tools = tools;
  inputs.body.toolConfig = {
    functionCallingConfig: {
      mode: "ANY",
    },
  };
  const response = await callGemini(
    inputs,
    model,
    (response) => {
      const r = response as GeminiAPIOutputs;
      if (r.candidates?.at(0)?.content) return;
      return err("No content");
    },
    retries
  );
  if (!ok(response)) {
    return toLLMContent("TODO: Handle Gemini error response");
  }
  const r = response as GeminiAPIOutputs;
  return r.candidates?.at(0)?.content || toLLMContent("No valid response");
}

async function generate(
  inputs: Omit<GeminiInputs, "model">,
  model: string,
  responseManager: StructuredResponse,
  retries: number
): Promise<Outcome<Outputs>> {
  const response = await callGemini(
    inputs,
    model,
    (response) => {
      return responseManager.parse(response);
    },
    retries
  );
  if (!ok(response)) {
    return response;
  } else {
    return {
      product: toLLMContent(responseManager.body, "model"),
      response: responseManager.response!,
    };
  }
}

async function invoke({
  id,
  work: context,
  description: instruction,
  model,
  toolManager,
  summarize,
  chat,
  makeList,
}: Inputs): Promise<Outcome<Outputs>> {
  // TODO: Make this a parameter.
  const retries = 5;
  const tools = toolManager.list();
  const mode = computeWorkMode(tools, summarize);
  const responseManager = new StructuredResponse(id, chat);
  if (mode === "call-tools") {
    const product = await callTools(
      {
        body: {
          contents: [...context, prompt(instruction, mode, chat)],
          systemInstruction: responseManager.instruction(),
          safetySettings: defaultSafetySettings(),
        },
      },
      model,
      tools,
      retries
    );
    return { product };
  } else {
    let product: LLMContent | null = null;
    if (makeList) {
      const generating = await new GeminiPrompt(
        {
          body: {
            contents: [...context, listPrompt(prompt(instruction, mode, chat))],
            safetySettings: defaultSafetySettings(),
            generationConfig: {
              responseSchema: listSchema(),
              responseMimeType: "application/json",
            },
          },
        },
        {
          toolManager,
        }
      ).invoke();
      if (!ok(generating)) return generating;

      const list = toList(generating.last);
      if (!ok(list)) return list;

      product = list;
    } else {
      const result = await generate(
        {
          body: {
            contents: responseManager.addPrompt(
              context,
              prompt(instruction, mode, chat)
            ),
            systemInstruction: responseManager.instruction(),
            safetySettings: defaultSafetySettings(),
          },
        },
        model,
        responseManager,
        retries
      );
      if ("$error" in result) {
        return result;
      }
      product = result.product;
    }
    return { product, epilog: responseManager.epilog };
  }
}

function prompt(
  description: LLMContent,
  mode: WorkMode,
  chat: boolean
): LLMContent {
  const preamble = llm`
${description}

`;
  const postamble = `

Today is ${new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;

  switch (mode) {
    case "summarize":
      return llm` 
${preamble}
Summarize the research results to fulfill the specified task.
${postamble}`.asContent();

    case "call-tools":
      return llm`
${preamble}
Generate multiple function calls to fulfill the specified task.
${postamble}`.asContent();

    case "generate":
      return llm`
${preamble}
Provide the response that fulfills the specified task.
${postamble}`.asContent();
  }
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        work: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Work",
        },
        description: {
          type: "object",
          behavior: ["llm-content"],
          title: "Job Description",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "object",
          behavior: ["llm-content"],
          title: "Work Product",
        },
      },
    } satisfies Schema,
  };
}
