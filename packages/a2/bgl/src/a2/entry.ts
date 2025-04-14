/**
 * @fileoverview Manages the entry point: describer, passing the inputs, etc.
 */

import {
  type AgentContext,
  type AgentInputs,
  type DescribeInputs,
} from "./common";
import { ok, toLLMContent, defaultLLMContent } from "./utils";
import { Template } from "./template";
import { readSettings } from "./settings";

export { invoke as default, describe };

export type EntryInputs = {
  context: LLMContent[];
  description: LLMContent;
  "p-chat": boolean;
  "p-list": boolean;
  [key: `p-z-${string}`]: unknown;
};

type Outputs = {
  context: AgentContext;
};

async function invoke({
  context,
  "p-chat": chat,
  "p-list": makeList,
  description,
  ...params
}: EntryInputs): Promise<Outputs> {
  // Make sure it's a boolean.
  chat = !!chat;
  context ??= [];
  const defaultModel = "";
  const type = "work";
  return {
    context: {
      id: Math.random().toString(36).substring(2, 5),
      chat,
      makeList,
      listPath: [],
      context,
      userInputs: [],
      defaultModel,
      model: "",
      description,
      tools: [],
      type,
      work: [],
      userEndedChat: false,
      params,
    },
  };
}

async function describe({ inputs: { description } }: DescribeInputs) {
  const settings = await readSettings();
  const experimental =
    ok(settings) && !!settings["Show Experimental Components"];
  const template = new Template(description);
  let extra: Record<string, Schema> = {};
  if (experimental) {
    extra = {
      "p-chat": {
        type: "boolean",
        title: "Chat with User",
        behavior: ["config", "hint-preview"],
        icon: "chat",
        description:
          "When checked, this step will chat with the user, asking to review work, requesting additional information, etc.",
      },
      "p-list": {
        type: "boolean",
        title: "Make a list",
        behavior: ["config", "hint-preview"],
        icon: "summarize",
        description:
          "When checked, this step will try to create a list as its output. Make sure that the prompt asks for a list of some sort",
      },
    };
  }
  return {
    inputSchema: {
      type: "object",
      properties: {
        description: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Instruction",
          description:
            "Give the model additional context on what to do, like specific rules/guidelines to adhere to or specify behavior separate from the provided context.",
          default: defaultLLMContent(),
        },
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
          behavior: ["main-port"],
        },
        ...extra,
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      ...template.requireds(),
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["main-port", "hint-text"],
        },
      },
    } satisfies Schema,
    title: "Make Text",
    metadata: {
      icon: "generative-text",
      tags: ["quick-access", "generative"],
      order: 1,
    },
  };
}
