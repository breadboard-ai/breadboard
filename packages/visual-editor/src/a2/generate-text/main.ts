/**
 * @fileoverview Add a description for your module here.
 */

import {
  createDoneTool,
  createKeepChattingResult,
  createKeepChattingTool,
  type ChatTool,
} from "./chat-tools.js";
import { createSystemInstruction } from "./system-instruction.js";
import type { SharedContext } from "./types.js";

import { ArgumentNameGenerator } from "../a2/introducer.js";
import { report } from "../a2/output.js";
import { Template } from "../a2/template.js";
import { ToolManager } from "../a2/tool-manager.js";
import { defaultLLMContent, err, ok, isEmpty } from "../a2/utils.js";

import { defaultSafetySettings, type GeminiInputs } from "../a2/gemini.js";
import { GeminiPrompt, type GeminiPromptOutput } from "../a2/gemini-prompt.js";
import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { filterUndefined } from "@breadboard-ai/utils";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export {
  invoke as default,
  describe,
  makeTextInstruction,
  makeText,
  GenerateText,
};

/**
 * Maximum amount of function-calling turns that we take before bailing.
 */
const MAX_TURN_COUNT = 10;

type Inputs = {
  context: SharedContext;
};

function makeTextInstruction({ pro }: { pro: boolean }) {
  if (pro) {
    return () =>
      `For this session, the user strongly prefers to use the "pro" model for "generate_text" function.`;
  }
  return () => "";
}

class GenerateText {
  private toolManager!: ToolManager;
  private doneTool!: ChatTool;
  private keepChattingTool!: ChatTool;
  public description!: LLMContent;
  public context!: LLMContent[];
  #hasTools = false;

  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs,
    public readonly sharedContext: SharedContext
  ) {
    this.invoke = this.invoke.bind(this);
  }

  async initialize(): Promise<Outcome<void>> {
    const { sharedContext } = this;
    const template = new Template(this.caps, sharedContext.description);
    const toolManager = new ToolManager(
      this.caps,
      this.moduleArgs,
      new ArgumentNameGenerator(this.caps, this.moduleArgs)
    );
    const doneTool = createDoneTool();
    const keepChattingTool = createKeepChattingTool();
    const substituting = await template.substitute(
      sharedContext.params,
      async (part) => toolManager.addTool(part)
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

  createSystemInstruction() {
    return createSystemInstruction(this.sharedContext.systemInstruction);
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
    work: LLMContent[]
  ): Promise<Outcome<LLMContent>> {
    const { sharedContext } = this;
    const toolManager = this.toolManager;
    const doneTool = this.doneTool;
    const keepChattingTool = this.keepChattingTool;

    const safetySettings = defaultSafetySettings();
    const systemInstruction = this.createSystemInstruction();
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
      if (this.toolManager.hasToolDeclarations()) {
        inputs.body.toolConfig = { functionCallingConfig: { mode: "ANY" } };
      }
    }
    inputs.body.systemInstruction = systemInstruction;
    const prompt = new GeminiPrompt(this.caps, this.moduleArgs, inputs, {
      toolManager,
    });
    const result = await prompt.invoke();
    if (!ok(result)) return result;
    const calledTools =
      prompt.calledTools || doneTool.invoked || keepChattingTool.invoked;
    if (prompt.saveOutputs) {
      return scrubFunctionResponses(result.last);
    }
    if (calledTools) {
      if (doneTool.invoked) {
        return result.last;
      }
      const invokedSubgraph = prompt.calledCustomTools;
      if (invokedSubgraph) {
        // Be careful to return subgraph output (which can be media) as-is
        // without rewriting/summarizing it with gemini because gemini cannot generate media.
        product = result.last;
      } else {
        if (!keepChattingTool.invoked) {
          contents.push(...result.all);
        }
        const inputs: GeminiInputs = {
          model: sharedContext.model,
          body: { contents, systemInstruction, safetySettings },
        };
        if (shouldAddTools) {
          // If we added function declarations (or saw a function call request) before, then we need to add them again so
          // Gemini isn't confused by the presence of a function call request.
          // However, set the mode to NONE so we don't call tools again.
          inputs.body.tools = [...tools];
          console.log("adding tools");
          // Can't set to functionCallingConfig mode to NONE, as that seems to hallucinate tool use.
        }
        const keepCallingGemini = true;
        let afterTools: GeminiPromptOutput | undefined = undefined;
        let turnCount = 0;
        while (keepCallingGemini) {
          if (turnCount > MAX_TURN_COUNT && toolManager.hasToolDeclarations()) {
            inputs.body.toolConfig = {
              functionCallingConfig: {
                mode: "NONE",
              },
            };
          }
          const nextTurn = new GeminiPrompt(
            this.caps,
            this.moduleArgs,
            inputs,
            { toolManager }
          );
          const nextTurnResult = await nextTurn.invoke();
          if (!ok(nextTurnResult)) return nextTurnResult;
          if (nextTurn.saveOutputs) {
            return scrubFunctionResponses(nextTurnResult.last);
          }
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
          return err(`Invalid state: Somehow, "afterTools" is undefined.`, {
            origin: "client",
            kind: "bug",
          });
        }
        product = afterTools.last;
      }
    } else {
      product = result.last;
    }

    return product;
  }

  get firstTurn(): boolean {
    return this.sharedContext.userInputs.length === 0;
  }

  get chat(): boolean {
    return this.sharedContext.chat;
  }

  get doneChatting(): boolean {
    return !!this.doneTool?.invoked;
  }
}

function done(result: LLMContent[]) {
  return { done: result };
}

function scrubFunctionResponses(c: LLMContent): LLMContent {
  return filterUndefined({
    parts: c.parts.filter((part) => !("functionResponse" in part)),
    role: c.role,
  });
}

async function keepChatting(
  caps: Capabilities,
  sharedContext: SharedContext,
  result: LLMContent[]
) {
  const last = result.at(-1)!;
  const product = last;
  await caps.output({
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

/**
 * Gets user feedback via caps.input().
 * This replaces the graph's `input` node.
 */
async function getUserFeedback(caps: Capabilities): Promise<LLMContent> {
  const inputSchema: Schema = {
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
  const response = await caps.input({ schema: inputSchema });
  return response.request as LLMContent;
}

/**
 * Joins user input into the shared context.
 * This replaces the graph's `join` module.
 */
function joinUserInput(
  sharedContext: SharedContext,
  request: LLMContent,
  lastResult: LLMContent
): void {
  sharedContext.userEndedChat = isEmpty(request);
  sharedContext.userInputs.push(request);
  if (!sharedContext.userEndedChat) {
    sharedContext.work.push(request);
  }
  sharedContext.last = lastResult;
}

/**
 * Type for makeText inputs - mirrors EntryInputs from entry.ts
 */
export type MakeTextInputs = {
  context: LLMContent[];
  description: LLMContent;
  "p-chat": boolean;
  "b-system-instruction": LLMContent;
  "p-model-name": string;
} & { [key: string]: unknown }; // Params

/**
 * Imperative replacement for the "Make Text" subgraph.
 * Combines entry, main loop, and join into a single function.
 */
async function makeText(
  inputs: MakeTextInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<{ done: LLMContent[] }>> {
  const {
    context: inputContext,
    description,
    "p-chat": chat,
    "b-system-instruction": systemInstruction,
    "p-model-name": model = "",
    ...params
  } = inputs;

  // === ENTRY phase: Initialize SharedContext ===
  const sharedContext: SharedContext = {
    id: Math.random().toString(36).substring(2, 5),
    chat: !!chat,
    context: inputContext ?? [],
    userInputs: [],
    defaultModel: model,
    model: model,
    description,
    type: "work",
    work: [],
    userEndedChat: false,
    params,
    systemInstruction,
  };

  // === MAIN LOOP: Generate + optionally chat ===
  while (true) {
    // Check if user ended chat on previous iteration
    if (sharedContext.userEndedChat) {
      const last = sharedContext.last;
      if (!last) {
        return err("Chat ended without any work", {
          origin: "client",
          kind: "bug",
        });
      }
      return done([...sharedContext.context, last]);
    }

    // Check for missing description
    if (!sharedContext.description) {
      const msg = "Please provide a prompt for the step";
      await report(caps, {
        actor: "Text Generator",
        name: msg,
        category: "Runtime error",
        details: `In order to run, I need to have an instruction.`,
      });
      return err(msg, { origin: "client", kind: "config" });
    }

    const gen = new GenerateText(caps, moduleArgs, sharedContext);
    const initializing = await gen.initialize();
    if (!ok(initializing)) return initializing;

    const result = await gen.invoke(gen.description, gen.context);
    if (!ok(result)) return result;

    // If done tool was invoked, return previous result
    if (gen.doneChatting) {
      const previousResult = sharedContext.work.at(-2);
      if (!previousResult) {
        return err("Done chatting, but have nothing to pass along", {
          origin: "client",
          kind: "bug",
        });
      }
      return done([previousResult]);
    }

    // If not in chat mode, we're done after first generation
    if (!gen.chat) {
      return done([result]);
    }

    // === CHAT MODE: Show output, get user input ===
    await keepChatting(caps, sharedContext, [result]);

    // Get user feedback (replaces the `input` node in the graph)
    const request = await getUserFeedback(caps);

    // === JOIN phase: Merge user input into context ===
    joinUserInput(sharedContext, request, result);

    // Update work for next iteration
    sharedContext.work = [...sharedContext.work.slice(0, -1), result];
    if (!sharedContext.userEndedChat) {
      sharedContext.work.push(request);
    }

    // Loop continues...
  }
}

async function invoke(
  { context }: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
) {
  if (!context.description) {
    const msg = "Please provide a prompt for the step";
    await report(caps, {
      actor: "Text Generator",
      name: msg,
      category: "Runtime error",
      details: `In order to run, I need to have an instruction.`,
    });
    return err(msg, { origin: "client", kind: "config" });
  }

  // Check to see if the user ended chat and return early.
  const { userEndedChat, last } = context;
  if (userEndedChat) {
    if (!last) {
      return err("Chat ended without any work", {
        origin: "client",
        kind: "bug",
      });
    }
    return done([...context.context, last]);
  }

  const gen = new GenerateText(caps, moduleArgs, context);
  const initializing = await gen.initialize();
  if (!ok(initializing)) return initializing;

  // Process single item directly (list support removed)
  const result = await gen.invoke(gen.description, gen.context);
  if (!ok(result)) return result;
  console.log("RESULT", result);
  if (gen.doneChatting) {
    // If done tool was invoked, rewind to remove the last interaction
    // and return that.
    const previousResult = context.work.at(-2);
    if (!previousResult) {
      return err(
        `Done chatting, but have nothing to pass along to next step.`,
        { origin: "client", kind: "bug" }
      );
    }
    return done([previousResult]);
  }

  if (gen.chat && !userEndedChat) {
    return keepChatting(caps, gen.sharedContext, [result]);
  }

  // Fall through to default response.
  return done([result]);
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
