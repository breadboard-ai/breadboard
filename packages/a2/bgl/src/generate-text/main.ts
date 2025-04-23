/**
 * @fileoverview Add a description for your module here.
 */

import output from "@output";

import type { SharedContext } from "./types";

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

type WorkMode = "generate" | "call-tools" | "summarize";

// type ChatResponse = {
//   response?: string;
//   requestForFeedback?: string;
//   userReadyToMoveOn?: boolean;
// };

// function chatSchema(): GeminiSchema {
//   return {
//     type: "object",
//     properties: {
//       response: {
//         type: "string",
//         description:
//           "Model response, in markdown. without any additional conversation",
//       },
//       requestForFeedback: {
//         type: "string",
//         description:
//           "Ask the user to provide feedback on the model response as a friendly assistant might or thank them when conversation concludes",
//       },
//       userReadyToMoveOn: {
//         type: "boolean",
//       },
//     },
//     required: ["response", "requestForFeedback", "userReadyToMoveOn"],
//   };
// }

// function getChatResponse(response: LLMContent): Outcome<ChatResponse> {
//   const part = response.parts.at(0);
//   if (part && "json" in part) {
//     return part.json as ChatResponse;
//   }
//   console.error("Invalid response from the model", response);
//   return err(`Invalid response from the model, see Dev Tools console`);
// }

function promptOld(description: LLMContent, mode: WorkMode): LLMContent {
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

class DoneTool {
  #invoked = false;

  public readonly name = "User_Says_Done";

  get invoked() {
    return this.#invoked;
  }

  public readonly declaration = {
    name: this.name,
    description:
      "Call when the user indicates they are done with the conversation and are ready to move on",
  };

  public readonly tool: Tool = {
    functionDeclarations: [this.declaration],
  };

  public readonly handle: ToolHandle = {
    tool: this.declaration,
    url: "",
    passContext: false,
    invoke: async () => {
      this.#invoked = true;
    },
  };
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
  const doneTool = new DoneTool();
  const substituting = await template.substitute(
    context.params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  if (context.chat) {
    toolManager.addCustomTool(doneTool.name, doneTool.handle);
  }
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
      // TODO: Make this work as well.
      const generating = await new GeminiPrompt(
        {
          body: {
            contents: [
              ...context.context,
              listPrompt(promptOld(description, mode)),
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
      const work = context.work.length > 0 ? context.work : [description];
      const contents = [...context.context, ...work];
      const safetySettings = defaultSafetySettings();
      //       const doneFunctionPreamble = context.chat
      //         ? llm`
      // If and only if, in the previous conversation context, the user indicates their satisfaction with the outcome of
      // the conversation and is asking to move on, set the "userReadyToMoveOn" flag to "true".

      // If there's no such indication, make sure to set the "userReadyToMoveOn" flag to "false".
      // IMPORTANT: Only set it to true when you actually hear the user indicate their intent to move on`.asContent()
      //         : llm``.asContent();
      const systemInstruction = llm`
IMPORTANT NOTE: Start directly with the output, do not output any delimiters.
Take a Deep Breath, read the instructions again, read the inputs again.
Each instruction is crucial and must be executed with utmost care and attention to detail.`.asContent();
      const tools = toolManager.list();
      const inputs: GeminiInputs = { body: { contents, safetySettings } };
      if (tools.length) {
        inputs.body.tools = [...tools];
        inputs.body.toolConfig = { functionCallingConfig: { mode: "ANY" } };
      }
      const prompt = new GeminiPrompt(inputs, { toolManager });
      const result = await prompt.invoke();
      if (!ok(result)) return result;
      if (prompt.calledTools) {
        if (doneTool.invoked) {
          return result.last;
        }
        contents.push(...result.all);
        const inputs: GeminiInputs = {
          body: { contents, systemInstruction, safetySettings },
        };
        // if (context.chat) {
        //   inputs.body.generationConfig = {
        //     responseSchema: chatSchema(),
        //     responseMimeType: "application/json",
        //   };
        // }
        const afterTools = await new GeminiPrompt(inputs).invoke();
        if (!ok(afterTools)) return afterTools;
        // if (context.chat) {
        //   const chatResponse = getChatResponse(afterTools.last);
        //   if (!ok(chatResponse)) return chatResponse;
        //   console.log("Chat response", chatResponse);
        //   product = llm`${chatResponse.response}`.asContent();
        // } else {
        product = afterTools.last;
        // }
      } else {
        product = result.last;
      }
    }
    return product;
  });
  if (!ok(result)) return result;
  // This really needs work, since it will not work with lists
  // Also the -2 is ugly.
  // TODO: Fix the ugly and listify.
  if (doneTool.invoked) {
    return { done: work.at(-2) };
  }

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
