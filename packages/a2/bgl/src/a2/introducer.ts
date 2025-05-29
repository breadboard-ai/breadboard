/**
 * @fileoverview Handles introduction of the step.
 */

import { type Tool, defaultSafetySettings, type GeminiSchema } from "./gemini";
import { toLLMContent, toText, ok, err, llm } from "./utils";
import { ToolManager } from "./tool-manager";
import { GeminiPrompt } from "./gemini-prompt";
import {
  type DescriberResult,
  type DescriberResultTransformer,
} from "./common";

export { ArgumentNameGenerator };

export type IntroPort = {
  $intro: boolean;
};

type Introduction = {
  title: string;
  abilities: string;
  argument: string;
};

function introductionSchema(): GeminiSchema {
  return {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "The title of the agent",
      },
      abilities: {
        type: "string",
        description:
          "Verb-first, third-person summary of the agent's abilities",
      },
      argument: {
        type: "string",
        description:
          "The description of the single text argument that the agent takes as input",
      },
    },
  };
}

type NamingResult = {
  description: string;
};

/**
 * Attempts to adjust the describer result for subgraphs.
 * Accounts for LLMContent[] `context` property
 * and parameters
 */
class ArgumentNameGenerator implements DescriberResultTransformer {
  #containsContext(describerResult: DescriberResult): boolean {
    if (!describerResult.inputSchema?.properties) return true;
    const context = describerResult.inputSchema.properties["context"];
    if (!context) return false;
    if (context.type === "array" && context.items) {
      return !!(context.items as Schema).behavior?.includes("llm-content");
    }
    return false;
  }

  async transform(
    describerResult: DescriberResult
  ): Promise<Outcome<DescriberResult | null>> {
    // If there's no `context` property, exit early.
    if (!this.#containsContext(describerResult)) {
      return null;
    }
    const { title, description } = describerResult;

    // Fail transform when there's no title or description.
    // The resulting function declaration will be a dud anyway.
    if (!title || !description) {
      return err(`Custom tool must have a title and a description`);
    }

    // Add parameters to the describer.
    const required: string[] = [];
    const params = Object.fromEntries(
      Object.entries(describerResult.inputSchema?.properties || {})
        .filter(([name]) => {
          if (name === "context") return false;
          required.push(name);
          return true;
        })
        .map(([name, value]) => {
          return [
            name,
            {
              ...value,
              type: "string",
            },
          ];
        })
    );
    if (required.length > 0) {
      return {
        ...describerResult,
        inputSchema: {
          type: "object",
          properties: params,
          required,
        },
      };
    }

    // When no parameters found, try to discern the parameter name
    // from description and title.
    const naming = await new GeminiPrompt({
      body: {
        contents: [this.prompt(describerResult)],
        safetySettings: defaultSafetySettings(),
        generationConfig: {
          responseSchema: this.schema(),
          responseMimeType: "application/json",
        },
      },
    }).invoke();
    if (!ok(naming)) return naming;
    const result = (naming.last.parts.at(0) as JSONPart).json as NamingResult;

    return {
      ...describerResult,
      inputSchema: {
        type: "object",
        properties: {
          context: {
            type: "string",
            description: result.description,
          },
        },
      },
    };
  }

  schema(): GeminiSchema {
    return {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "One-sentence description of a function argument",
        },
      },
    };
  }

  prompt(describerResult: DescriberResult): LLMContent {
    return llm`
You are amazing at describing things. Today, you will be coming up a one-sentence description 
of a function argument.

The function's title is: ${describerResult.title}

The function's description is ${describerResult.description}

It takes a single argument.

Come up with a one-sentence description of this argument based on the title/description,
with the aim of using this description in a JSON Schema.
`.asContent();
  }
}
