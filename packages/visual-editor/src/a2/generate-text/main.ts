/**
 * @fileoverview Add a description for your module here.
 */

import {
  createSystemInstruction,
  defaultSystemInstruction,
} from "./system-instruction.js";
import type { SharedContext } from "./types.js";

import { ArgumentNameGenerator } from "../a2/introducer.js";
import { report } from "../a2/output.js";
import { Template } from "../a2/template.js";
import { ToolManager } from "../a2/tool-manager.js";
import { defaultLLMContent, err, ok } from "../a2/utils.js";

import { defaultSafetySettings, type GeminiInputs } from "../a2/gemini.js";
import { GeminiPrompt, type GeminiPromptOutput } from "../a2/gemini-prompt.js";
import { LLMContent, Outcome, Schema } from "@breadboard-ai/types";
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
  public description!: LLMContent;
  public context!: LLMContent[];
  #hasTools = false;

  constructor(
    private readonly moduleArgs: A2ModuleArgs,
    public readonly sharedContext: SharedContext
  ) {
    this.invoke = this.invoke.bind(this);
  }

  async initialize(): Promise<Outcome<void>> {
    const { sharedContext } = this;
    const template = new Template(
      sharedContext.description,
      this.moduleArgs.context.currentGraph
    );
    const toolManager = new ToolManager(
      this.moduleArgs,
      new ArgumentNameGenerator(this.moduleArgs)
    );
    const substituting = await template.substitute(
      sharedContext.params,
      async (part) => toolManager.addTool(part)
    );
    this.#hasTools = toolManager.hasTools();
    if (!ok(substituting)) {
      return substituting;
    }
    this.description = substituting;
    this.toolManager = toolManager;
    this.context = [...sharedContext.context, ...sharedContext.work];
  }

  createSystemInstruction() {
    return createSystemInstruction(this.sharedContext.systemInstruction);
  }

  /**
   * Invokes the text generator.
   * Significant mode flags:
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

    const safetySettings = defaultSafetySettings();
    const systemInstruction = this.createSystemInstruction();
    const tools = toolManager.list();
    const shouldAddTools = this.#hasTools;

    let product: LLMContent;
    const context = [description];
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
    const prompt = new GeminiPrompt(this.moduleArgs, inputs, {
      toolManager,
    });
    const result = await prompt.invoke();
    if (!ok(result)) return result;
    const calledTools = prompt.calledTools;
    if (prompt.saveOutputs) {
      return scrubFunctionResponses(result.last);
    }
    if (calledTools) {
      const invokedSubgraph = prompt.calledCustomTools;
      if (invokedSubgraph) {
        // Be careful to return subgraph output (which can be media) as-is
        // without rewriting/summarizing it with gemini because gemini cannot generate media.
        product = result.last;
      } else {
        contents.push(...result.all);
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
          const nextTurn = new GeminiPrompt(this.moduleArgs, inputs, {
            toolManager,
          });
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

/**
 * Type for makeText inputs - mirrors EntryInputs from entry.ts
 * Properties are optional because they come from port mapping and may have defaults.
 */
export type MakeTextInputs = {
  context?: LLMContent[];
  description?: LLMContent;
  "b-system-instruction"?: LLMContent;
  "p-model-name"?: string;
} & { [key: string]: unknown }; // Params

/**
 * Imperative replacement for the "Make Text" subgraph.
 * Combines entry, main loop, and join into a single function.
 */
async function makeText(
  inputs: MakeTextInputs,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<{ context: LLMContent[] }>> {
  const {
    context: inputContext,
    description,
    "b-system-instruction": systemInstruction,
    "p-model-name": model = "",
    ...params
  } = inputs;

  // === ENTRY phase: Initialize SharedContext ===
  const sharedContext: SharedContext = {
    id: Math.random().toString(36).substring(2, 5),
    context: inputContext ?? [],
    defaultModel: model,
    model,
    description,
    type: "work",
    work: [],
    params,
    systemInstruction,
  };

  // Check for missing description
  if (!sharedContext.description) {
    const msg = "Please provide a prompt for the step";
    await report(moduleArgs, {
      actor: "Text Generator",
      name: msg,
      category: "Runtime error",
      details: `In order to run, I need to have an instruction.`,
    });
    return err(msg, { origin: "client", kind: "config" });
  }

  const gen = new GenerateText(moduleArgs, sharedContext);
  const initializing = await gen.initialize();
  if (!ok(initializing)) return initializing;

  const result = await gen.invoke(gen.description, gen.context);
  if (!ok(result)) return result;

  return { context: [result] };
}

async function invoke({ context }: Inputs, moduleArgs: A2ModuleArgs) {
  if (!context.description) {
    const msg = "Please provide a prompt for the step";
    await report(moduleArgs, {
      actor: "Text Generator",
      name: msg,
      category: "Runtime error",
      details: `In order to run, I need to have an instruction.`,
    });
    return err(msg, { origin: "client", kind: "config" });
  }

  const gen = new GenerateText(moduleArgs, context);
  const initializing = await gen.initialize();
  if (!ok(initializing)) return initializing;

  // Process single item directly (list support removed)
  const result = await gen.invoke(gen.description, gen.context);
  if (!ok(result)) return result;
  console.log("RESULT", result);

  // Fall through to default response.
  return done([result]);
}

/**
 * Describe inputs for the generate-text module.
 */
export type DescribeInputs = {
  inputs: Partial<{
    context: LLMContent[];
    description: LLMContent;
    "b-system-instruction": LLMContent;
    "p-model-name": string;
  }>;
};

async function describe({ inputs: { description } }: DescribeInputs) {
  const advancedSchema: Schema["properties"] = {
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
  };
  const template = new Template(description);

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
        ...advancedSchema,
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
