/**
 * @fileoverview Manages the entry point: describer, passing the inputs, etc.
 */

import { type Params } from "../a2/common";
import { readSettings } from "../a2/settings";
import { Template } from "../a2/template";
import { defaultLLMContent, ok } from "../a2/utils";
import { defaultSystemInstruction } from "./system-instruction";
import type { SharedContext } from "./types";

export { invoke as default, describe };

export type EntryInputs = {
  context: LLMContent[];
  description: LLMContent;
  "p-chat": boolean;
  "p-list": boolean;
  "p-sequential-fc": boolean;
  "b-system-instruction": LLMContent;
  "p-model-name": string;
  "config$ask-user"?: boolean;
} & Params;

export type DescribeInputs = {
  inputs: EntryInputs;
};

type Outputs = {
  context: SharedContext;
};

async function invoke({
  context,
  "p-chat": chat,
  "p-list": makeList,
  "p-sequential-fc": useSequentialFunctionCalling,
  "b-system-instruction": systemInstruction,
  "p-model-name": model = "",
  description,
  ...params
}: EntryInputs): Promise<Outputs> {
  // Make sure it's a boolean.
  chat = !!chat;
  context ??= [];
  const type = "work";
  return {
    context: {
      id: Math.random().toString(36).substring(2, 5),
      chat,
      makeList,
      useSequentialFunctionCalling,
      listPath: [],
      context,
      userInputs: [],
      defaultModel: model,
      model: model,
      description,
      type,
      work: [],
      userEndedChat: false,
      params,
      systemInstruction,
    },
  };
}

async function describe({
  inputs: { description, "config$ask-user": chat },
}: DescribeInputs) {
  const settings = await readSettings();
  const chatSchema: BehaviorSchema[] = chat ? ["hint-chat-mode"] : [];
  const experimental =
    ok(settings) && !!settings["Show Experimental Components"];
  const template = new Template(description);
  let extra: Record<string, Schema> = {};
  if (experimental) {
    extra = {
      "p-list": {
        type: "boolean",
        title: "Make a list",
        behavior: ["config", "hint-preview", "hint-advanced"],
        icon: "summarize",
        description:
          "When checked, this step will try to create a list as its output. Make sure that the prompt asks for a list of some sort",
      },
      "p-sequential-fc": {
        type: "boolean",
        title: "Allow multi-turn tool-calling",
        behavior: ["config", "hint-advanced"],
        description:
          "When checked, the step may call tools multiple times across multiple turns",
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
          title: "Prompt",
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
        "p-chat": {
          type: "boolean",
          title: "Review with user",
          behavior: ["config", "hint-preview", "hint-advanced"],
          icon: "chat",
          description:
            "When checked, this step will chat with the user, asking to review work, requesting additional information, etc.",
        },
        "b-system-instruction": {
          type: "object",
          behavior: ["llm-content", "config", "hint-advanced"],
          title: "System Instruction",
          description: "The system instruction for the model",
          default: JSON.stringify(defaultSystemInstruction()),
        },
        "p-model-name": {
          type: "string",
          behavior: ["llm-content"],
          title: "Model",
          description: "The specific model version to generate with",
        },
        ...extra,
        ...template.schemas(),
      },
      behavior: ["at-wireable", ...chatSchema],
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
