/**
 * @fileoverview Break an objective into tasks and then execute them.
 */
import {
  Capabilities,
  LLMContent,
  Outcome,
  Schema,
} from "@breadboard-ai/types";
import { type Params } from "../a2/common.js";
import { ArgumentNameGenerator } from "../a2/introducer.js";
import { readSettings } from "../a2/settings.js";
import { Template } from "../a2/template.js";
import { ToolManager } from "../a2/tool-manager.js";
import { err, ok } from "../a2/utils.js";
import { ParallelStrategist } from "./parallel-strategist.js";
import { Runtime } from "./runtime.js";
import { SequentialStrategist } from "./sequential-strategist.js";
import { ThinkStrategist } from "./think-strategist.js";
import { type Strategist } from "./types.js";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { invoke as default, makeGoOverListInstruction, describe };

const makeGoOverListInstruction = (inputs: Record<string, unknown>) => {
  let strategy: string;
  if (inputs.strategy === STRATEGISTS[1].name) {
    strategy = `Plan tasks as a sequence, anticipating that each next task will depend on the previous one:`;
  } else if (inputs.strategy === STRATEGISTS[2].name) {
    strategy = `Plan as you go, anticipating that each next task result will affect the rest of the plan`;
  } else {
    strategy = `Plan all tasks and do them at once, in parallel:`;
  }
  return `Carefully plan and execute to fulfill the objective below. ${strategy}`;
};

type Inputs = {
  context: LLMContent[];
  plan: LLMContent;
  strategy: string;
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

async function invoke(
  { context, plan: objective, strategy, ...params }: Inputs,
  caps: Capabilities,
  moduleArgs: A2ModuleArgs
): Promise<Outcome<Outputs>> {
  const toolManager = new ToolManager(
    caps,
    moduleArgs,
    new ArgumentNameGenerator(caps, moduleArgs)
  );
  const template = new Template(
    caps,
    objective,
    moduleArgs.context.currentGraph
  );
  const substituting = await template.substitute(params, async (part) =>
    toolManager.addTool(part)
  );
  if (!ok(substituting)) return substituting;

  const strategist = findStrategist(strategy);
  if (!strategist) {
    return err(`Unknown strategy: "${strategy}"`);
  }

  // Process single item directly (list support removed)
  const executor = new Runtime(caps, moduleArgs, context, toolManager);
  const executingOne = await executor.executeStrategy(substituting, strategist);
  if (!ok(executingOne)) return executingOne;

  const oneContent = {
    role: "model",
    parts: executingOne.flatMap((item) => {
      return item.parts;
    }),
  };

  return { context: [oneContent] };
}

type DescribeInputs = {
  inputs: {
    plan: LLMContent;
  };
};

async function describe(
  { inputs: { plan } }: DescribeInputs,
  caps: Capabilities
) {
  const template = new Template(caps, plan);
  const settings = await readSettings(caps);
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
