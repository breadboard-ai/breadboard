/**
 * @fileoverview Add a description for your module here.
 */

import output from "@output";

import type { SharedContext } from "./types";

import { report } from "./a2/output";
import { err, ok, defaultLLMContent, llm } from "./a2/utils";
import { Template } from "./a2/template";
import { ArgumentNameGenerator } from "./a2/introducer";
import { ToolManager } from "./a2/tool-manager";
import { ListExpander, listPrompt, toList, listSchema } from "./a2/lists";

import { defaultSafetySettings } from "./a2/gemini";
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

type WorkMode = "generate" | "call-tools" | "summarize";

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
  const substituting = await template.substitute(
    context.params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  console.log("Tools", substituting);
  if (!ok(substituting)) {
    return substituting;
  }

  const { work } = context;
  const mode = "generate";
  const result = await new ListExpander(
    substituting,
    work.length > 0 ? work : context.context
  ).map(async (description, work, isList) => {
    // Disallow making nested lists
    const makeList = context.makeList && !isList;

    let product: LLMContent;
    if (makeList) {
      const generating = await new GeminiPrompt(
        {
          body: {
            contents: [
              ...context.context,
              listPrompt(prompt(description, mode, context.chat)),
            ],
            safetySettings: defaultSafetySettings(),
            generationConfig: {
              responseSchema: listSchema(),
              responseMimeType: "application/json",
            },
            tools: toolManager.list(),
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
      const result = await new GeminiPrompt(
        {
          body: {
            contents: [
              ...context.context,
              prompt(description, mode, context.chat),
            ],
            safetySettings: defaultSafetySettings(),
            tools: toolManager.list(),
          },
        },
        {
          toolManager,
        }
      ).invoke();
      if (!ok(result)) return result;
      product = result.last;
    }
    return product;
  });
  if (!ok(result)) return result;

  // 4) Handle chat.
  let epilog;
  if (context.chat) {
    const last = result.at(-1)!;
    epilog ??= "Please provide feedback on the draft";
    await output({
      schema: {
        type: "object",
        properties: {
          "a-product": {
            type: "object",
            behavior: ["llm-content"],
            title: "Draft",
          },
          "b-message": {
            type: "string",
            title: "",
            format: "markdown",
          },
        },
      },
      $metadata: {
        title: "Writer",
        description: "Asking for feedback on a draft",
        icon: "generative-text",
      },
      "b-message": epilog,
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
