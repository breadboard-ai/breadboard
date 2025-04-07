/**
 * @fileoverview The main body of the agent
 */
import output from "@output";
import { type AgentContext, type DescriberResult } from "./common";
import { ToolManager } from "./tool-manager";
import workerWorker from "./worker-worker";
import { report } from "./output";
import { defaultLLMContent, toText, err, endsWithRole, ok, llm } from "./utils";
import invokeGraph from "@invoke";
import { Template } from "./template";
import { ArgumentNameGenerator } from "./introducer";
import { ListExpander } from "./lists";

export { invoke as default, describe };

type Inputs = {
  context: AgentContext;
};

type Outputs = {
  $error?: string;
  context?: AgentContext;
  toInput?: Schema;
  done?: LLMContent[];
};

function toLLMContent(
  text: string,
  role: LLMContent["role"] = "user"
): LLMContent {
  return { parts: [{ text }], role };
}

async function invoke({ context }: Inputs): Promise<Outputs> {
  console.log("AGENT MAIN", context);
  let {
    id,
    description,
    context: initialContext,
    model,
    defaultModel,
    tools,
    chat,
    makeList,
    work: workContext,
    params,
  } = context;
  if (!description) {
    const $error = "No instruction supplied";
    await report({
      actor: "Text Generator",
      name: $error,
      category: "Runtime error",
      details: `In order to run, I need to have an instruction.`,
    });
    return { $error };
  }
  const template = new Template(description);
  const toolManager = new ToolManager(new ArgumentNameGenerator());
  const substituting = await template.substitute(
    params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  if (!ok(substituting)) {
    return substituting;
  }
  description = substituting;

  if (!(await toolManager.initialize(tools))) {
    const $error = `Problem initializing tools. 
The following errors were encountered: ${toolManager.errors.join(",")}`;
    console.error("MAIN ERROR", $error, toolManager.errors);
    return { $error };
  }

  const { userEndedChat, userInputs, last } = context;
  if (userEndedChat) {
    if (!last) {
      return err("Chat ended without any work");
    }
    return {
      done: [...initialContext, last],
    };
  }
  let epilog: string | undefined;
  const result = await new ListExpander(
    description,
    workContext.length > 0 ? workContext : initialContext
  ).map(async (description, work, isList) => {
    // Disallow making nested lists
    const disallowNestedMakeList = makeList && !isList;

    // 1) Make first attempt to make text
    const response = await workerWorker({
      id,
      description,
      work,
      model,
      toolManager,
      summarize: false,
      chat,
      makeList: disallowNestedMakeList,
    });
    if (!ok(response)) {
      console.error("ERROR FROM WORKER", response.$error);
      return response;
    }
    const workerResponse = response.product;
    epilog = response.epilog;

    // 2) Call tools
    const toolResults: object[] = [];
    // TODO: Convert to GeminiPrompt. Somebody. Please.
    const errors: string[] = [];
    await toolManager.processResponse(workerResponse, async ($board, args) => {
      const result = await invokeGraph({
        $board,
        ...args,
      });
      if ("$error" in result) {
        errors.push(result.$error as string);
      }
      toolResults.push(result);
    });
    console.log("TOOL RESULTS", toolResults);
    if (errors.length > 0) {
      console.error("TOOL ERRORS", errors);
      return err(`Tool Errors: ${errors.join("\n\n")}`);
    }

    // 3) Handle tool results
    if (toolResults.length > 0) {
      const summary = await workerWorker({
        id,
        description,
        work: [
          ...toolResults.map((toolResult) =>
            toLLMContent(JSON.stringify(toolResult))
          ),
        ],
        model,
        toolManager,
        summarize: true,
        chat: false,
        makeList: disallowNestedMakeList,
      });
      if (!ok(summary)) {
        console.error("ERROR FROM SUMMARY", summary.$error);
        return summary;
      }
      console.log("SUMMARY RESPONSE", summary);
      const summaryResponse = summary.product;
      epilog = summary.epilog;
      return summaryResponse;
    }

    return workerResponse;
  });
  if (!ok(result)) return result;

  // 4) Handle chat.
  if (chat) {
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
          type: "object",
          title: "Agent Context",
        },
      },
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        toInput: {
          type: "object",
          title: "Input Schema",
        },
        context: {
          type: "object",
          title: "Agent Context",
        },
        done: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Done",
        },
      },
    } satisfies Schema,
  };
}
