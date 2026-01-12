/**
 * @fileoverview Recursively search the web for in-depth answers to your query.
 */
import { Capabilities, LLMContent, Schema } from "@breadboard-ai/types";
import { type Params } from "../a2/common.js";
import { Template } from "../a2/template.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";
import { executeOpalAdkStream } from "../a2/opal-adk-stream.js";
import invokeGemini, {
  type GeminiInputs,
  type Tool,
  defaultSafetySettings,
} from "../a2/gemini.js";
import { ArgumentNameGenerator } from "../a2/introducer.js";
import { report } from "../a2/output.js";
import { ToolManager } from "../a2/tool-manager.js";
import { addUserTurn, err, llm, ok, toLLMContent } from "../a2/utils.js";

export { invoke as default, describe, makeDeepResearchInstruction };

function makeDeepResearchInstruction() {
  return "Do deep, iterative research to fulfill the following objective:";
}

export type ResearcherInputs = {
  context?: LLMContent[];
  query: LLMContent;
  summarize: boolean;
} & Params;

export type DefaultToolDescriptor = {
  url: string;
  title: string;
};

const RESEARCH_TOOLS: DefaultToolDescriptor[] = [
  {
    url: "embed://a2/tools.bgl.json#module:search-web",
    title: "Search Web",
  },
  {
    url: "embed://a2/tools.bgl.json#module:get-webpage",
    title: "Get Webpage",
  },
  {
    url: "embed://a2/tools.bgl.json#module:search-maps",
    title: "Search Maps",
  },
];

const RESEARCH_MODEL = "gemini-2.5-flash";

const MAX_ITERATIONS = 7;

function systemInstruction(first: boolean): string {
  const which = first ? "first" : "next";
  return `You are a researcher.

Your job is to use the provided query to produce raw research that will be later turned into a detailed research report.
You are tasked with finding as much of relevant information as possible.

You examine the conversation context so far and come up with the ${which} step to produce the report, 
using the conversation context as the the guide of steps taken so far and the outcomes recorded.

You do not ask user for feedback. You do not try to have a conversation with the user. 
You know that the user will only ask you to proceed to next step.

Looking back at all that you've researched and the query/research plan, do you have enough to produce the detailed report? If so, you are done.

Now, provide a response. Your response must contain two parts:
Thought: a brief plain text reasoning why this is the right ${which} step and a description of what you will do in plain English.
Action: invoking the tools are your disposal, more than one if necessary. If you're done, do not invoke any tools.`;
}

function researcherPrompt(
  contents: LLMContent[],
  query: LLMContent,
  tools: Tool[],
  first: boolean
): GeminiInputs {
  return {
    model: RESEARCH_MODEL,
    body: {
      contents: addUserTurn(
        llm`
Do the research according about this topic:

---

${query}

---
`.asContent(),
        contents
      ),
      tools,
      systemInstruction: toLLMContent(systemInstruction(first)),
      safetySettings: defaultSafetySettings(),
    },
  };
}

function reportWriterInstruction() {
  return `You are a research report writer.
Your teammates produced a wealth of raw research about the supplied query.

Your task is to take the raw research and write a thorough, detailed research report that answers the provided query. Use markdown.

A report must additionally contain references to the source (always cite your sources).`;
}

function reportWriterPrompt(
  _query: LLMContent,
  research: string[]
): GeminiInputs {
  return {
    model: RESEARCH_MODEL,
    body: {
      contents: [toLLMContent(research.join("\n\n"))],
      systemInstruction: toLLMContent(reportWriterInstruction()),
      safetySettings: defaultSafetySettings(),
    },
  };
}

async function thought(
  caps: Capabilities,
  response: LLMContent,
  iteration: number
) {
  const first = response.parts?.at(0);
  if (!first || !("text" in first)) {
    return;
  }
  await report(caps, {
    actor: "Researcher",
    category: `Progress report, iteration ${iteration + 1}`,
    name: "Thought",
    icon: "generative",
    details: first.text
      .replace(/^Thought: ?/gm, "")
      .replace(/^Action:.*$/gm, "")
      .trim(),
  });
}

export function unwrapParams(params: Params): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (key.startsWith("p-z-")) {
        return [key.slice(4), value];
      }
      return [key, value];
    })
  );
}

function extractTextFromLLMContent(content: [LLMContent]): string {
  const query = content[0]
  if (!query.parts || query.parts.length === 0) {
    return "";
  }
  if (query.parts.length > 1) {
    throw new Error("LLMContent contains more than one part.");
  }
  const firstPart = query.parts[0];
  if ("text" in firstPart && typeof firstPart.text === "string") {
    return firstPart.text;
  }
  return "";
}


async function invokeOpalAdk(
  { context, query, summarize, ...params }: ResearcherInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
) {
  const unwrappedParams = unwrapParams(params);
  const userQuery = unwrappedParams['ask_user_research_query'] as [LLMContent];
  if (!userQuery) {
    return err("No query provided");
  }
  console.log("unwrapped params", unwrappedParams);
  const results = await executeOpalAdkStream(caps, moduleArgs, { "query": extractTextFromLLMContent(userQuery) }, "deep_research");
  console.log("deep-research results", results)
  return {
    context: [...(context || []), results]
  };
}

async function invokeLegacy(
  { context, query, summarize, ...params }: ResearcherInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
) {
  console.log('calling deep research agent.')
  const tools = RESEARCH_TOOLS.map((descriptor) => descriptor.url);
  const toolManager = new ToolManager(
    caps,
    moduleArgs,
    new ArgumentNameGenerator(caps, moduleArgs)
  );
  let content = context || [toLLMContent("Start the research")];

  const template = new Template(caps, query);
  const substituting = await template.substitute(params, async (part) =>
    toolManager.addTool(part)
  );
  if (!ok(substituting)) {
    return substituting;
  }

  if (!toolManager.hasTools()) {
    // If no tools supplied (legacy case, actually), initialize
    // with a set of default tools.
    const initializing = await toolManager.initialize(tools);
    if (!initializing) {
      return err("Unable to initialize tools");
    }
  }
  query = substituting;

  const research: string[] = [];
  for (let i = 0; i <= MAX_ITERATIONS; i++) {
    const askingGemini = await invokeGemini(
      researcherPrompt(content, query, toolManager.list(), i === 0),
      caps,
      moduleArgs
    );

    if (!ok(askingGemini)) {
      return askingGemini;
    }
    if ("context" in askingGemini) {
      return err(`Unexpected "context" response`);
    }
    const response = askingGemini.candidates.at(0)?.content;
    if (!response) {
      return err("No actionable response");
    }
    await thought(caps, response, i);

    const callingTools = await toolManager.callTools(response, true, []);
    if (!ok(callingTools)) return callingTools;

    const toolResponses = callingTools.results || [];
    if (toolResponses.length === 0) {
      break;
    }
    research.push(
      ...toolResponses.map((response) => functionResponseToText(response))
    );
    content = [...content, response, ...toolResponses.flat()];
  }
  if (research.length === 0) {
    await report(caps, {
      actor: "Researcher",
      category: "Error",
      name: "Error",
      details: "I was unable to obtain any research results",
    });
    return { context };
  }
  if (summarize) {
    const producingReport = await invokeGemini(
      reportWriterPrompt(query, research),
      caps,
      moduleArgs
    );
    if (!ok(producingReport)) {
      return producingReport;
    }
    if ("context" in producingReport) {
      return err(`Unexpected "context" response`);
    }
    const response = producingReport.candidates.at(0)?.content;
    if (!response) {
      return err("No actionable response");
    }
    return { context: [...(context || []), response] };
  }
  const results = research.map((r) => JSON.parse(r)["results"]);
  return {
    context: [...(context || []), toLLMContent(results.join("\n\n\n"))],
  };
}

async function invoke(
  { context, query, summarize, ...params }: ResearcherInputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
) {
  //const flags = await moduleArgs.context.flags?.flags();
  const opalAdkEnabled = true; // flags?.opalAdk || false;
  if (opalAdkEnabled) {
    return invokeOpalAdk({ context, query, summarize, ...params }, caps, moduleArgs);
  } else {
    return invokeLegacy({ context, query, summarize, ...params }, caps, moduleArgs);
  }
}

type DescribeInputs = {
  inputs: {
    query: LLMContent;
  };
};

function toOxfordList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(" and ");
  const lastItem = items.pop();
  return `${items.join(", ")}, and ${lastItem}`;
}

function researchExample(): string[] {
  const type = "tool";
  const tools = RESEARCH_TOOLS.map(({ url: path, title }) =>
    Template.part({ title, path, type })
  );
  return [
    JSON.stringify({
      query: toLLMContent(
        `Research the topic provided using ${toOxfordList(tools)} tools`
      ),
    }),
  ];
}

async function describe(
  { inputs: { query } }: DescribeInputs,
  caps: Capabilities
) {
  const template = new Template(caps, query);
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
        query: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Research Query",
          description:
            "Provide a brief description of what to research, what areas to cover, etc.",
        },
        summarize: {
          type: "boolean",
          behavior: ["config", "hint-preview", "hint-advanced"],
          icon: "summarize",
          title: "Summarize research",
          description:
            "If checked, the Researcher will summarize the results of the research and only pass the research summary along.",
        },
        ...template.schemas(),
      },
      behavior: ["at-wireable"],
      ...template.requireds(),
      additionalProperties: false,
      examples: researchExample(),
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
      additionalProperties: false,
    } satisfies Schema,
    title: "Do deep research",
    description: "Do deep research on the provided query",
    metadata: {
      icon: "generative-search",
      tags: ["quick-access", "generative"],
      order: 101,
    },
  };
}

function functionResponseToText(content: LLMContent[]) {
  const last = content.at(-1);
  if (!last) return "";
  return last.parts
    .filter((part) => "functionResponse" in part)
    .map((part) => {
      const response = part.functionResponse.response;
      if (typeof response === "string") {
        return response;
      } else {
        return JSON.stringify(response);
      }
    })
    .join("\n\n");
}