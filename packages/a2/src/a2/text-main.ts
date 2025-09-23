/**
 * @fileoverview Calls Gemini agent loop.
 */

import { err } from "./utils";

export { invoke as default, describe };

type TextMainInputs = {
  context: LLMContent | "nothing";
  request?: LLMContent;
};

type TextMainOutputs = {
  context: LLMContent[];
};

async function invoke({
  context,
  request,
}: TextMainInputs): Promise<Outcome<TextMainOutputs>> {
  if (context == "nothing") {
    if (!request) {
      return err(`No text supplied.`);
    }
    return { context: [request] };
  }
  return { context: [context] };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "object",
          title: "Context in",
        },
        request: {
          type: "object",
          title: "Data From Input",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
        },
      },
    } satisfies Schema,
  };
}
