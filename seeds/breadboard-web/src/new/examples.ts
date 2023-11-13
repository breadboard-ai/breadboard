/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";

import {
  NodeValue,
  InputValues,
  OutputValues,
  flow,
  action,
  addKit,
  NodeFactory,
} from "./lib.js";

import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

config();

const core = addKit(Core) as unknown as {
  passthrough: NodeFactory<InputValues, OutputValues>;
};
const llm = addKit(Starter) as unknown as {
  promptTemplate: NodeFactory<
    { template: string; [key: string]: NodeValue },
    { prompt: string }
  >;
  secrets: NodeFactory<{ keys: string[] }, { [k: string]: string }>;
  generateText: NodeFactory<
    { text: string; PALM_KEY: string },
    { completion: string }
  >;
  runJavascript: NodeFactory<
    {
      code: string;
      name: string;
      raw: boolean;
      [key: string]: NodeValue;
    },
    { result: NodeValue; [k: string]: NodeValue }
  >;
};

/*
const passthroughHandler = async (inputs: PromiseLike<InputValues>) => {
  return Promise.resolve(await inputs);
};

const passthrough = addNodeType("passthrough", async (inputs) =>
  Promise.resolve(await inputs)
);

const promptTemplate = addNodeType<
  { template: string; [key: string]: NodeValue },
  { prompt: string }
>("promptTemplate", async (inputs: PromiseLike<{ template: string }>) =>
  Promise.resolve({ prompt: (await inputs).template })
);
const secrets = addNodeType(
  "secrets",
  async (inputs: PromiseLike<{ keys: string[] }>) =>
    Promise.resolve(
      Object.fromEntries(
        (await inputs).keys.map((key) => [key, "SECRET"])
      ) as Partial<{ [k: string]: string }>
    )
);
const generateText = addNodeType(
  "generateText",
  async (inputs: PromiseLike<{ prompt: string; PALM_KEY: string }>) =>
    Promise.resolve({ completion: (await inputs).prompt })
);
const runJavascript = addNodeType("runJavascript", passthroughHandler);
*/

async function singleNode() {
  const graph = core.passthrough({ foo: "bar" });

  const result = await graph;

  console.log("simple node", await graph.serialize(), result);
}
await singleNode();

async function simpleFunction() {
  const graph = flow(
    async (inputs) => {
      const { foo } = await core.passthrough(inputs);
      return { foo };
    },
    { foo: "bar", baz: "bar" }
  );

  const result = await graph;

  console.log("simple function", await graph.serialize(), result);
}
await simpleFunction();

// Because there is no `await` this actually builds a graph that then is run
async function simpleFunctionGraph() {
  const graph = flow(
    (inputs) => {
      const p1 = core.passthrough(inputs);
      const { foo } = p1; // Get an output, as a Promise!
      return { foo };
    },
    { foo: "bar", bar: "baz" }
  );

  const result = await graph;

  console.log("simple function graph", await graph.serialize(), result);
}
await simpleFunctionGraph();

async function customAction() {
  const graph = flow(
    (inputs) => {
      return flow(async (inputs) => {
        const { a, b } = await inputs;
        return { result: ((a as number) || 0) + ((b as number) || 0) };
      }, inputs);
    },
    { a: 1, b: 2 }
  );

  const result = await graph;

  console.log("custom action", await graph.serialize(), result);
}
await customAction();

async function mathImperative() {
  const graph = flow(
    (inputs) => {
      const { prompt } = llm.promptTemplate({
        template:
          "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
        question: inputs.question,
      });
      const { completion } = llm.generateText({
        text: prompt,
        PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
      });
      const result = llm.runJavascript({ code: completion });
      return result;
    },
    { question: "1+1" }
  );

  const result = await graph;

  console.log("mathImperative", await graph.serialize(), result);
}
await mathImperative();

async function mathChainGraph() {
  const graph = flow(
    (inputs) => {
      return llm
        .promptTemplate({
          template:
            "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
          question: inputs.question,
        })
        .prompt.as("text")
        .to(
          llm.generateText({
            PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
          })
        )
        .completion.as("code")
        .to(llm.runJavascript());
    },
    { question: "1+1" }
  );

  const result = await graph;

  console.log("mathChainGraph", await graph.serialize(), result);
}
await mathChainGraph();

async function mathChainDirectly() {
  const graph = core
    .passthrough({ question: "1+1" })
    .to(
      llm.promptTemplate({
        template:
          "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
      })
    )
    .prompt.as("text")
    .to(
      llm.generateText({
        PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
      })
    )
    .completion.as("code")
    .to(llm.runJavascript());

  const result = await graph;

  console.log("mathChainGraphDirectly", await graph.serialize(), result);
}
await mathChainDirectly();

async function ifElse() {
  const math = action((inputs) => {
    return llm
      .promptTemplate({
        template:
          "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
        question: inputs.question,
      })
      .prompt.as("text")
      .to(llm.generateText({ PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }) }))
      .completion.as("code")
      .to(llm.runJavascript());
  });

  const search = action((inputs) => {
    // TODO: Implement
    return inputs;
  });

  const graph = flow(
    async (inputs) => {
      const { completion } = await llm
        .promptTemplate({
          template:
            "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
          question: inputs.question,
        })
        .prompt.as("text")
        .to(
          llm.generateText({
            PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
          })
        );
      if (completion && (completion as string).startsWith("YES")) {
        return math({ question: inputs.question });
      } else {
        return search(inputs);
      }
    },
    { question: "1+1" }
  );

  const result = await graph;

  console.log("ifElse", await graph.serialize(), result);
}
await ifElse();

async function ifElseSerializable() {
  const math = action((inputs) => {
    return llm
      .promptTemplate({
        template:
          "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
        question: inputs.question,
      })
      .prompt.as("text")
      .to(llm.generateText({ PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }) }))
      .completion.as("code")
      .to(llm.runJavascript());
  });

  const search = action((inputs) => {
    // TODO: Implement
    return inputs;
  });

  const graph = flow(
    async (inputs) => {
      return llm
        .promptTemplate({
          template:
            "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
          question: inputs.question,
        })
        .prompt.as("text")
        .to(llm.generateText({ PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }) }))
        .to(
          async (inputs) => {
            const { completion, math, search } = await inputs;
            if (completion?.startsWith("YES")) {
              return math({ question: inputs.question });
            } else {
              return search(inputs);
            }
          },
          { math, search }
        );
    },
    { question: "1+1" }
  );

  const result = await graph;

  console.log("ifElseSerializable", await graph.serialize(), result);
}
await ifElseSerializable();
