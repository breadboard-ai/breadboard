/**
 * @fileoverview Joins user input and Agent Context
 */

import { type AgentContext } from "./common";
import { isEmpty } from "./utils";
import { addContent } from "./lists";

export { invoke as default, describe };

type Inputs = {
  context: AgentContext;
  request: LLMContent;
};

type Outputs = {
  context: AgentContext;
};

async function invoke({ context, request }: Inputs): Promise<Outputs> {
  context.userEndedChat = isEmpty(request);
  context.userInputs.push(request);
  if (!context.userEndedChat) {
    context.work = addContent(context.work, request);
  }
  return { context };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          title: "Agent Context",
          type: "object",
        },
        request: {
          title: "User Input",
          type: "object",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          title: "Agent Context",
          type: "object",
        },
      },
    } satisfies Schema,
  };
}
