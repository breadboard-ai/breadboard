/**
 * @fileoverview Add a description for your module here.
 */

import output from "@output";

import type { SharedContext } from "./types";
import { createDoneTool, createKeepChattingTool } from "./chat-tools";

import { report } from "./a2/output";
import { err, ok, defaultLLMContent, llm } from "./a2/utils";
import { Template } from "./a2/template";
import { ArgumentNameGenerator } from "./a2/introducer";
import { ToolManager, type ToolHandle } from "./a2/tool-manager";
import { ListExpander, listPrompt, toList, listSchema } from "./a2/lists";

import {
  defaultSafetySettings,
  type GeminiInputs,
  type GeminiSchema,
  type Tool,
} from "./a2/gemini";
import { GeminiPrompt } from "./a2/gemini-prompt";

export { invoke as default, describe };

type Inputs = {
  context: SharedContext;
};

type Outputs = {
  $error?: string;
  context?: SharedContext;
  toInput?: Schema;
  done?: LLMContent[];
};

async function invoke({ context }: Inputs) {
  if (!context.description) {
    const msg = "No instruction supplied";
    await report({
      actor: "Text Generator",
      name: msg,
      category: "Runtime error",
      details: `In order to run, I need to have an instruction.`,
    });
    return err(msg);
  }

  // Check to see if the user ended chat and return early.
  const { userEndedChat, userInputs, last } = context;
  if (userEndedChat) {
    if (!last) {
      return err("Chat ended without any work");
    }
    return {
      done: [...context.context, last],
    };
  }

  const template = new Template(context.description);
  const toolManager = new ToolManager(new ArgumentNameGenerator());
  const doneTool = createDoneTool();
  const keepChattingTool = createKeepChattingTool();
  const substituting = await template.substitute(
    context.params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  const hasTools = toolManager.hasTools();
  if (context.chat) {
    toolManager.addCustomTool(doneTool.name, doneTool.handle());
    if (!hasTools) {
      toolManager.addCustomTool(
        keepChattingTool.name,
        keepChattingTool.handle()
      );
    }
  }
  if (!ok(substituting)) {
    return substituting;
  }

  const { work } = context;
  const result = await new ListExpander(substituting, [
    ...context.context,
    ...work,
  ]).map(async (description, work, isList) => {
    // Disallow making nested lists
    const makeList = context.makeList && !isList;

    let product: LLMContent;
    const contents = work.length > 0 ? work : [description];
    const safetySettings = defaultSafetySettings();
    const systemInstruction = llm`

Today is ${new Date().toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}
    
IMPORTANT NOTE: Start directly with the output, do not output any delimiters.
Take a Deep Breath, read the instructions again, read the inputs again.
Each instruction is crucial and must be executed with utmost care and attention to detail.`.asContent();
    const tools = toolManager.list();
    const inputs: GeminiInputs = { body: { contents, safetySettings } };
    if (context.chat) {
      inputs.body.tools = [...tools];
      inputs.body.toolConfig = { functionCallingConfig: { mode: "ANY" } };
    }
    const prompt = new GeminiPrompt(inputs, { toolManager });
    const result = await prompt.invoke();
    if (!ok(result)) return result;
    const calledTools =
      prompt.calledTools || doneTool.invoked || keepChattingTool.invoked;
    if (calledTools) {
      if (doneTool.invoked) {
        return result.last;
      }
      if (!keepChattingTool.invoked) {
        contents.push(...result.all);
      }
      const inputs: GeminiInputs = {
        body: { contents, systemInstruction, safetySettings },
      };
      const afterTools = await new GeminiPrompt(inputs).invoke();
      if (!ok(afterTools)) return afterTools;
      product = afterTools.last;
    } else {
      product = result.last;
    }

    return product;
  });
  if (!ok(result)) return result;
  console.log("RESULT", result);
  // This really needs work, since it will not work with lists
  // TODO: Listify.
  if (doneTool.invoked) {
    // If done tool was invoked, rewind removing the last interaction
    // and return that.
    const previousResult = work.at(-2);
    return previousResult ? { done: [previousResult] } : { done: result };
  }

  // 4) Handle chat.
  if (context.chat) {
    const last = result.at(-1)!;
    await output({
      schema: {
        type: "object",
        properties: {
          "a-product": {
            type: "object",
            behavior: ["llm-content"],
            title: "Draft",
          },
        },
      },
      $metadata: {
        title: "Writer",
        description: "Asking user",
        icon: "generative-text",
      },
      "a-product": last,
    });

    const { userInputs } = context;
    if (!userEndedChat) {
      const toInput: Schema = {
        type: "object",
        properties: {
          request: {
            type: "object",
            title: "Please provide feedback",
            description: "Provide feedback or click submit to continue",
            behavior: ["transient", "llm-content"],
            examples: [defaultLLMContent()],
          },
        },
      };
      return {
        toInput,
        context: {
          ...context,
          work: result,
          last,
        },
      };
    }
  }

  // 5) Fall through to default response.
  return { done: result };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
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
