/**
 * @fileoverview Generates code using supplied context.
 */

import invokeBoard from "@invoke";

import gemini, {
  defaultSafetySettings,
  type GeminiOutputs,
  type GeminiInputs,
  type Tool,
} from "./gemini";
import { err, ok, toLLMContent, toText, addUserTurn } from "./utils";
import { Template } from "./template";
import { ToolManager } from "./tool-manager";
import { type Params } from "./common";
import { report } from "./output";
import { ArgumentNameGenerator } from "./introducer";

const MAKE_CODE_ICON = "generative-code";

type CodeGeneratorInputs = {
  context: LLMContent[];
  instruction: LLMContent;
  language: string;
} & Params;

type CodeGeneratorOutputs = {
  context: LLMContent[];
};

export { invoke as default, describe };

function gatheringRequest(
  contents: LLMContent[] | undefined,
  instruction: LLMContent,
  language: string,
  toolManager: ToolManager
): GeminiPrompt {
  const promptText = `
Analyze the instruction below and rather than following it, determine what information needs to be gathered to 
generate an accurate prompt for a text-to-${language} model in the next turn:
-- begin instruction --
${toText(instruction)}
-- end instruction --

Call the tools to gather the necessary information that could be used to create an accurate prompt.`;
  return new GeminiPrompt(
    {
      model: "gemini-1.5-flash-latest",
      body: {
        contents: addUserTurn(promptText, contents),
        tools: toolManager.list(),
        systemInstruction: toLLMContent(`
You are a researcher whose specialty is to call tools whose output helps gather the necessary information
to be used to create an accurate prompt for a text-to-${language} model.
`),
      },
    },
    toolManager
  );
}

function promptRequest(
  contents: LLMContent[] | undefined,
  instruction: LLMContent,
  language: string
): GeminiPrompt {
  const context = contents?.length
    ? "using conversation context and these additional"
    : "with these";
  const promptText = `Generate a single text-to-${language} prompt ${context} instructions:
${toText(instruction)}

Typical output format:

## Setting/background

Detailed description of everything that is understood about the ${language} code that is being requested.

## Primary focus

Detailed description of the primary functionality or the main focal point of the JavaScript code.

## Style

Detailed description of the style and approach of the code (defensive, TDD, creative, etc.). The output should
always an invariably be ${language === "JavaScript" ? "EcmaScript JavaScript Modules" : language} and be fully functional 
without any placeholders. 

If you are dealing with JavaScript you may use imports if and only if the instruction indicates, otherwise you must
create the functionality as a standalone piece of EcmaScript JavaScript.

You output will be fed directly into the text-to-${language} model, so it must be prompt only, no additional chit-chat
`;
  return new GeminiPrompt({
    model: "gemini-1.5-flash-latest",
    body: {
      contents: addUserTurn(promptText, contents),
      systemInstruction: toLLMContent(`
You are a world-class ${language} developer whose specialty is to write prompts for text-to-${language} models that 
always generate valid outputs.

The prompt must describe every aspect of the functionality in great detail and describe the problem being solved 
in terms of data structures, algorithms, and style. You must use the instruction to fully understand and replicate
any reference implementations you've been given and you must not augment or deviate from that style. You should
ensure that the prompt includes enough information to fully replicate that style with examples and maximal clarity.

If the code pertains to user interface work, you must also maximize the accessibility of the code generated with
appropriate titles and labels for buttons, controls, inputs, etc, and they should never be empty.

Be sure to export all relevant symbols so that the code can be used outside of the EcmaScript Module. Always do
this as named symbols rather than using default exports.

If writing JavaScript, and where a variable is private, use private fields (#field) rather than an underscore at the start.
`),
    },
  });
}

function codeRequest(prompt: LLMContent, language: string): GeminiPrompt {
  prompt.role = "user";
  prompt.parts.unshift({
    text: `Generate ${language} code based on this prompt. Output code only, no chit-chat`,
  });

  return new GeminiPrompt({
    model: "gemini-2.0-flash-exp",
    body: {
      contents: [prompt],
      generationConfig: {
        responseModalities: ["TEXT"],
      },
      safetySettings: defaultSafetySettings(),
    },
  });
}

export type GeminiPromptOutput = {
  last: LLMContent;
  all: LLMContent[];
};

class GeminiPrompt {
  constructor(
    public readonly inputs: GeminiInputs,
    public readonly toolManager?: ToolManager
  ) {}

  async invoke(): Promise<Outcome<GeminiPromptOutput>> {
    const invoking = await gemini(this.inputs);
    if (!ok(invoking)) return invoking;
    if ("context" in invoking) {
      return err("Invalid output from Gemini -- must be candidates");
    }
    const content = invoking.candidates.at(0)?.content;
    if (!content) {
      return err("No content from Gemini");
    }
    const results: string[] = [];
    const errors: string[] = [];
    await this.toolManager?.processResponse(content, async ($board, args) => {
      const callingTool = await invokeBoard({ $board, ...args });
      if ("$error" in callingTool) {
        errors.push(JSON.stringify(callingTool.$error));
      } else {
        results.push(JSON.stringify(callingTool));
      }
    });
    if (errors.length) {
      return err(
        `Calling tools generated the following errors: ${errors.join(",")}`
      );
    }
    const result = [content];
    if (results.length) {
      result.push(toLLMContent(results.join("\n\n")));
    }
    return { all: result, last: result.at(-1)! };
  }
}

function gracefulExit(notOk: {
  $error: string;
}): Outcome<CodeGeneratorOutputs> {
  report({
    actor: "Make Code",
    category: "Warning",
    name: "Graceful exit",
    details: `I tried a couple of times, but the Gemini API failed to generate the code you requested with the following error:

### ${notOk.$error}

To keep things moving, I will return a blank result. My apologies!`,
    icon: MAKE_CODE_ICON,
  });
  return { context: [toLLMContent(" ")] };
}

const MAX_RETRIES = 5;

async function invoke({
  context,
  instruction,
  language,
  ...params
}: CodeGeneratorInputs): Promise<Outcome<CodeGeneratorOutputs>> {
  context ??= [];

  // 1) Substitute params in instruction.
  const toolManager = new ToolManager(new ArgumentNameGenerator());
  const substituting = await new Template(instruction).substitute(
    params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  if (!ok(substituting)) {
    return substituting;
  }
  instruction = substituting;

  // 2) If there are tools in instruction, add an extra step of preparing
  // information via tools.
  if (toolManager.hasTools()) {
    const gatheringInformation = await gatheringRequest(
      context,
      instruction,
      language,
      toolManager
    ).invoke();
    if (!ok(gatheringInformation)) return gatheringInformation;
    context.push(...gatheringInformation.all);
  }

  let retryCount = MAX_RETRIES;

  while (retryCount--) {
    // 3) Call Gemini to generate prompt.
    const generatingPrompt = await promptRequest(
      context,
      instruction,
      language
    ).invoke();
    if (!ok(generatingPrompt)) return generatingPrompt;

    console.log("PROMPT", toText(generatingPrompt.last));

    // 4) Call Gemini to generate image.
    const generatingCode = await codeRequest(
      generatingPrompt.last,
      language
    ).invoke();
    if (!ok(generatingCode)) {
      return generatingCode;
    }

    return { context: generatingCode.all };
  }
  return gracefulExit(
    err(`Failed to generate ${language} after ${MAX_RETRIES} tries.`)
  );
}

type DescribeInputs = {
  inputs: {
    instruction?: LLMContent;
  };
};

async function describe({ inputs: { instruction } }: DescribeInputs) {
  const template = new Template(instruction);
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
        instruction: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Instruction",
          description:
            "Describe how to generate the JavaScript based on the input: focus, functionality, aim of the code",
        },
        language: {
          type: "string",
          behavior: ["hint-text", "config", "hint-preview"],
          title: "Language",
          icon: "frame-source",
          enum: ["JavaScript", "HTML", "CSS"],
          description: "The language you'd like to generate",
          default: "JavaScript",
        },
        ...template.schemas(),
      },
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
          behavior: ["hint-code", "main-port"],
        },
      },
      additionalProperties: false,
    } satisfies Schema,
    title: "Make Code",
    metadata: {
      icon: MAKE_CODE_ICON,
      tags: ["quick-access", "generative", "experimental"],
      order: 2,
    },
  };
}
