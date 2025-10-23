/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { Template } from "../a2/template";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";
import { isLLMContent, isLLMContentArray } from "@breadboard-ai/data";

export { invoke as default, describe };

type AgentInputs = {
  config$prompt: LLMContent;
};

type AgentOutputs = {
  context: LLMContent[];
};

async function invoke(
  { config$prompt, ...rest }: AgentInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleFactoryArgs
): Promise<Outcome<AgentOutputs>> {
  const params = Object.fromEntries(
    Object.entries(rest).filter(([key]) => key.startsWith("p-z-"))
  );
  const template = new Template(caps, config$prompt);
  const objective = template.simpleSubstitute((param) => {
    const { type } = param;
    switch (type) {
      case "asset": {
        return `<file src="${param.path}" />`;
      }
      case "in": {
        const value = params[param.path];
        if (!value) {
          return "";
        } else if (typeof value === "string") {
          return value;
        } else if (isLLMContent(value)) {
          return substituteParts(value);
        } else if (isLLMContentArray(value)) {
          const last = value.at(-1);
          if (!last) return "";
          return substituteParts(last);
        } else {
          console.warn(`Agent: Unknown param value type`, value);
        }
        return param.title;
      }
      case "param":
        console.warn(`Agent: Params aren't supported in template substitution`);
        return "";
      case "tool":
      default:
        return param.title;
    }

    function substituteParts(value: LLMContent) {
      const values: string[] = [];
      for (const part of value.parts) {
        if ("text" in part) {
          values.push(part.text);
        } else {
          values.push(`<file src="${JSON.stringify(part)}" />`);
        }
      }
      return values.join("\n");
    }
  });
  console.log("inputs", objective, caps, moduleArgs);
  return { context: [objective] };
}

async function describe({ config$prompt }: AgentInputs, caps: Capabilities) {
  const template = new Template(caps, config$prompt);
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
          behavior: ["main-port"],
        },
        config$prompt: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Objective",
          description: "The objective for the agent",
        },
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      ...template.requireds(),
      additionalProperties: false,
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
      additionalProperties: false,
    } satisfies Schema,
    title: "Agent",
    description: "Iteratively works to solve the stated objective",
    metadata: {
      icon: "generative-search",
      tags: ["quick-access", "generative"],
      order: 101,
    },
  };
}
