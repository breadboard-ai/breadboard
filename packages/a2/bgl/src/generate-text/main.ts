/**
 * @fileoverview Add a description for your module here.
 */

import output from "@output";

import type { SharedContext } from "./types";
import { report } from "./a2/output";
import { err, ok, defaultLLMContent } from "./a2/utils";
import { Template } from "./a2/template";
import { ArgumentNameGenerator } from "./a2/introducer";
import { ToolManager } from "./a2/tool-manager";
import { ListExpander } from "./a2/lists";

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
  const substituting = await template.substitute(
    context.params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  if (!ok(substituting)) {
    return substituting;
  }

  const { work, makeList } = context;
  const result = await new ListExpander(
    substituting,
    work.length > 0 ? work : context.context
  ).map(async (description, work, isList) => {
    // Disallow making nested lists
    const disallowNestedMakeList = makeList && !isList;

    // 1) Make first attempt to make text

    // 2) Call tools

    // 3) Handle tool results

    return { parts: [{ text: "FOO" }] };
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
