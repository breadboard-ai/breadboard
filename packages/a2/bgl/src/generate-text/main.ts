/**
 * @fileoverview Add a description for your module here.
 */

import output from "@output";

import {
  createDoneTool,
  createKeepChattingResult,
  createKeepChattingTool,
  type ChatTool,
} from "./chat-tools";
import { createSystemInstruction } from "./system-instruction";
import type { SharedContext } from "./types";

import { ArgumentNameGenerator } from "../a2/introducer";
import { ListExpander, listSchema, toList } from "../a2/lists";
import { report } from "../a2/output";
import { Template } from "../a2/template";
import { ToolManager } from "../a2/tool-manager";
import { defaultLLMContent, err, ok } from "../a2/utils";

import { defaultSafetySettings, type GeminiInputs } from "../a2/gemini";
import { GeminiPrompt, type GeminiPromptOutput } from "../a2/gemini-prompt";

export { invoke as default, describe };

type Inputs = {
  context: SharedContext;
};

class GenerateText {
  private toolManager!: ToolManager;
  private doneTool!: ChatTool;
  private keepChattingTool!: ChatTool;
  public description!: LLMContent;
  public context!: LLMContent[];
  public listMode = false;
  #hasTools = false;

  constructor(public readonly sharedContext: SharedContext) {
    this.invoke = this.invoke.bind(this);
  }

  async initialize(): Promise<Outcome<void>> {
    const { sharedContext } = this;
    const template = new Template(sharedContext.description);
    const toolManager = new ToolManager(new ArgumentNameGenerator());
    const doneTool = createDoneTool();
    const keepChattingTool = createKeepChattingTool();
    const substituting = await template.substitute(
      sharedContext.params,
      async ({ path: url, instance }) => toolManager.addTool(url, instance)
    );
    this.#hasTools = toolManager.hasTools();
    if (sharedContext.chat) {
      toolManager.addCustomTool(doneTool.name, doneTool.handle());
      if (!this.#hasTools) {
        toolManager.addCustomTool(
          keepChattingTool.name,
          keepChattingTool.handle()
        );
      }
    }
    if (!ok(substituting)) {
      return substituting;
    }
    this.description = substituting;
    this.toolManager = toolManager;
    this.doneTool = doneTool;
    this.keepChattingTool = keepChattingTool;
    this.context = [...sharedContext.context, ...sharedContext.work];
  }

  createSystemInstruction(makeList: boolean) {
    return createSystemInstruction(
      this.sharedContext.systemInstruction,
      makeList
    );
  }

  addKeepChattingResult(context: LLMContent[]) {
    context.push(createKeepChattingResult());
    return context;
  }

  /**
   * Invokes the text generator.
   * Significant mode flags:
   * - chat: boolean -- chat mode is on/off
   * - tools: boolean -- whether or not has tools
   * - makeList: boolean -- asked to generate a list
   * - isList: boolean -- is currently in list mode
   * - model: string -- the model to generate with
   */
  async invoke(
    description: LLMContent,
    work: LLMContent[],
    isList: boolean
  ): Promise<Outcome<LLMContent>> {
    const { sharedContext } = this;
    const toolManager = this.toolManager;
    const doneTool = this.doneTool;
    const keepChattingTool = this.keepChattingTool;
    // Disallow making nested lists (for now).
    const makeList = sharedContext.makeList && !isList;

    const safetySettings = defaultSafetySettings();
    const systemInstruction = this.createSystemInstruction(makeList);
    const tools = toolManager.list();
    // Unless it's a very first turn, we always supply tools when chatting,
    // since we add the "Done" and "Keep Chatting" tools to figure out when
    // the conversation ends.
    // In the first turn, we actually create fake "keep chatting" result,
    // to help the LLM get into the rhythm. Like, "come on, LLM".
    const firstTurn = this.firstTurn;
    const shouldAddTools = (this.chat && !firstTurn) || this.#hasTools;
    const shouldAddFakeResult = this.chat && firstTurn;

    let product: LLMContent;
    const context =
      !shouldAddTools && shouldAddFakeResult
        ? this.addKeepChattingResult([description])
        : [description];
    const contents = [...context, ...work];
    const inputs: GeminiInputs = {
      body: { contents, safetySettings },
      model: sharedContext.model,
    };
    if (shouldAddTools) {
      inputs.body.tools = [...tools];
      inputs.body.toolConfig = { functionCallingConfig: { mode: "ANY" } };
    } else {
      // When we have tools, the first call will not try to make a list,
      // because JSON mode and tool-calling are incompatible.
      if (makeList) {
        inputs.body.generationConfig = {
          responseSchema: listSchema(),
          responseMimeType: "application/json",
        };
      }
    }
    inputs.body.systemInstruction = systemInstruction;
    const prompt = new GeminiPrompt(inputs, { toolManager });
    const result = await prompt.invoke();
    if (!ok(result)) return result;
    const calledTools =
      prompt.calledTools || doneTool.invoked || keepChattingTool.invoked;
    if (calledTools) {
      if (doneTool.invoked) {
        return result.last;
      }
      const invokedSubgraph = prompt.calledCustomTools;
      if (invokedSubgraph) {
        if (makeList && !this.chat) {
          // This case might be unusual (making a list of images directly?),
          // but handle it for completeness.
          // TODO: support this case properly. This seems
          const list = toList(result.last);
          if (!ok(list)) return list;
          product = list;
        } else {
          // Be careful to return subgraph output (which can be media) as-is
          // without rewriting/summarizing it with gemini because gemini cannot generate media.
          product = result.last;
        }
      } else {
        if (!keepChattingTool.invoked) {
          contents.push(...result.all);
        }
        const inputs: GeminiInputs = {
          model: sharedContext.model,
          body: { contents, systemInstruction, safetySettings },
        };
        if (makeList) {
          inputs.body.generationConfig = {
            responseSchema: listSchema(),
            responseMimeType: "application/json",
          };
        } else {
          if (shouldAddTools) {
            // If we added function declarations (or saw a function call request) before, then we need to add them again so
            // Gemini isn't confused by the presence of a function call request.
            // However, set the mode to NONE so we don't call tools again.
            inputs.body.tools = [...tools];
            console.log("adding tools");
            // Can't set to functionCallingConfig mode to NONE, as that seems to hallucinate tool use.
          }
        }
        const keepCallingGemini = true;
        let afterTools: GeminiPromptOutput | undefined = undefined;
        let turnCount = 0;
        while (keepCallingGemini) {
          if (
            !this.sharedContext.useSequentialFunctionCalling ||
            turnCount > 5
          ) {
            inputs.body.toolConfig = {
              functionCallingConfig: {
                mode: "NONE",
              },
            };
          }
          const nextTurn = new GeminiPrompt(inputs, { toolManager });
          const nextTurnResult = await nextTurn.invoke();
          if (!ok(nextTurnResult)) return nextTurnResult;
          if (!nextTurn.calledTools && !nextTurn.calledCustomTools) {
            afterTools = nextTurnResult;
            break;
          }
          inputs.body.contents = [
            ...inputs.body.contents,
            ...nextTurnResult.all,
          ];
          turnCount++;
        }
        if (!afterTools) {
          return err(`Invalid state: Somehow, "afterTools" is undefined.`);
        }
        if (makeList && !this.chat) {
          const list = toList(afterTools.last);
          if (!ok(list)) return list;
          product = list;
        } else {
          product = afterTools.last;
        }
      }
    } else {
      if (makeList && !this.chat) {
        const list = toList(result.last);
        if (!ok(list)) return list;
        product = list;
      } else {
        product = result.last;
      }
    }

    return product;
  }

  get firstTurn(): boolean {
    return this.sharedContext.userInputs.length === 0;
  }

  get chat(): boolean {
    // When we are in list mode, disable chat.
    // Can't have chat inside of a list (yet).
    return this.sharedContext.chat && !this.listMode;
  }

  get doneChatting(): boolean {
    return !!this.doneTool?.invoked;
  }
}

function done(result: LLMContent[], makeList: boolean = false) {
  if (makeList) {
    const list = toList(result.at(-1)!);
    if (!ok(list)) return list;
    result = [list];
  }
  return { done: result };
}

async function keepChatting(
  sharedContext: SharedContext,
  result: LLMContent[],
  isList: boolean
) {
  const last = result.at(-1)!;
  let product = last;
  if (isList) {
    const list = toList(last);
    if (!ok(list)) return list;
    product = list;
  }
  await output({
    schema: {
      type: "object",
      properties: {
        "a-product": {
          type: "object",
          behavior: ["llm-content", "hint-chat-mode"],
          title: "Draft",
        },
      },
    },
    $metadata: {
      title: "Writer",
      description: "Asking user",
      icon: "generative-text",
    },
    "a-product": product,
  });

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
      ...sharedContext,
      work: result,
      last,
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
  const { userEndedChat, last } = context;
  if (userEndedChat) {
    if (!last) {
      return err("Chat ended without any work");
    }
    return done([...context.context, last], context.makeList);
  }

  const gen = new GenerateText(context);
  const initializing = await gen.initialize();
  if (!ok(initializing)) return initializing;

  const expander = new ListExpander(gen.description, gen.context);
  expander.expand();
  gen.listMode = expander.list().length > 1;

  const result = await expander.map(gen.invoke);
  if (!ok(result)) return result;
  console.log("RESULT", result);
  if (gen.doneChatting) {
    // If done tool was invoked, rewind to remove the last interaction
    // and return that.
    const previousResult = context.work.at(-2);
    if (!previousResult) {
      return err(`Done chatting, but have nothing to pass along to next step.`);
    }
    return done([previousResult], context.makeList);
  }

  // Use the gen.chat here, because it will correctly prevent
  // chat mode when we're in list mode.
  if (gen.chat && !userEndedChat) {
    return keepChatting(gen.sharedContext, result, context.makeList);
  }

  // Fall through to default response.
  return done(result);
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
