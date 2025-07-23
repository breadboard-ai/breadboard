/**
 * @fileoverview Break an objective into tasks and then execute them.
 */
import { type Params } from "../a2/common";
import { ArgumentNameGenerator } from "../a2/introducer";
import { fanOutContext } from "../a2/lists";
import { readSettings } from "../a2/settings";
import { Template } from "../a2/template";
import { ToolManager } from "../a2/tool-manager";
import { err, generateId, ok } from "../a2/utils";
import { ParallelStrategist } from "./parallel-strategist";
import { Runtime } from "./runtime";
import { SequentialStrategist } from "./sequential-strategist";
import { ThinkStrategist } from "./think-strategist";
import { type Strategist } from "./types";

export { invoke as default, describe };

type Inputs = {
  context: LLMContent[];
  plan: LLMContent;
  strategy: string;
  "z-list": boolean;
} & Params;

type Outputs = {
  context: LLMContent[];
};

const STRATEGISTS: Strategist[] = [
  new ParallelStrategist(),
  new SequentialStrategist(),
  new ThinkStrategist(),
];

function findStrategist(name?: string): Strategist | undefined {
  if (!name) return STRATEGISTS[0];
  return STRATEGISTS.find((strategist) => strategist.name === name);
}

async function invoke({
  context,
  plan: objective,
  strategy,
  "z-list": makeList,
  ...params
}: Inputs): Promise<Outcome<Outputs>> {
  const toolManager = new ToolManager(new ArgumentNameGenerator());
  const template = new Template(objective);
  const substituting = await template.substitute(
    params,
    async ({ path: url, instance }) => toolManager.addTool(url, instance)
  );
  if (!ok(substituting)) return substituting;

  const strategist = findStrategist(strategy);
  if (!strategist) {
    return err(`Unknown strategy: "${strategy}"`);
  }

  const result = await fanOutContext(
    substituting,
    context,
    async (objective, context, isList) => {
      const disallowNestedLists = makeList && !isList;
      const executor = new Runtime(context, toolManager, disallowNestedLists);
      const executingOne = await executor.executeStrategy(
        objective,
        strategist
      );
      if (!ok(executingOne)) return executingOne;

      // Disallow making a list when already inside of a make list
      if (disallowNestedLists) {
        return {
          role: "model",
          parts: [
            {
              id: generateId(),
              list: executingOne.map((item) => {
                return { content: [item] };
              }),
            },
          ],
        };
      }

      const oneContent = {
        role: "model",
        parts: executingOne.flatMap((item) => {
          return item.parts;
        }),
      };

      return oneContent;
    }
  );
  if (!ok(result)) return result;
  return { context: result };
}

type DescribeInputs = {
  inputs: {
    plan: LLMContent;
  };
};

async function describe({ inputs: { plan } }: DescribeInputs) {
  const template = new Template(plan);
  const settings = await readSettings();
  const experimental =
    ok(settings) && !!settings["Show Experimental Components"];
  let extra: Record<string, Schema> = {};
  if (experimental) {
    extra = {
      // "z-list": {
      //   type: "boolean",
      //   title: "Make a list",
      //   behavior: ["config", "hint-preview", "hint-advanced"],
      //   icon: "summarize",
      //   description:
      //     "When checked, this step will try to create a list as its output. Make sure that the prompt asks for a list of some sort",
      // },
    };
  }
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
        plan: {
          type: "object",
          behavior: ["llm-content", "config", "hint-preview"],
          title: "Objective",
          description:
            "Describe what will be turned into a list and then gone over",
        },
        strategy: {
          title: "Strategy",
          description: `How to go over the list: 
"${STRATEGISTS[0].name}" is fastest, working in parallel. 
"${STRATEGISTS[1].name}" will build on previous work.
"${STRATEGISTS[2].name}" will think after each step adjust the list if necessary`,
          type: "string",
          behavior: ["config", "hint-preview", "hint-advanced"],
          enum: STRATEGISTS.map((strategist) => strategist.name),
          icon: "joiner",
          default: STRATEGISTS[0].name,
        },
        ...extra,
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
          title: "Results",
          behavior: ["main-port"],
        },
      },
      additionalProperties: false,
    } satisfies Schema,
    title: "Plan and Execute",
    description: "Break an objective into tasks and then execute them",
    metadata: {
      icon: "laps",
      tags: ["quick-access", "generative", "experimental"],
      order: 102,
    },
  };
}
