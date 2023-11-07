/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeValue,
  NodeProxy,
  InputValues,
  addNodeType,
  flow,
  action,
  Runner,
} from "./wires-proposal-7-lib.js";

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

async function singleNode() {
  const graph = passthrough({ foo: "bar" });

  console.log("spread", { ...graph });

  const result = await graph;

  console.log("simple graph", result);
}
singleNode();

async function simpleFunction() {
  const runner = new Runner();

  const result = await runner.flow(
    async (inputs) => {
      const { foo } = await passthrough(inputs);
      return { foo };
    },
    { foo: "bar", bar: "baz" }
  );

  console.log("simple function", result);
}
simpleFunction();

// Because there is no `await` this actually builds a graph that then is run
async function simpleFunctionGraph() {
  const result = await flow(
    (inputs) => {
      const p1 = passthrough(inputs);
      const { foo } = p1; // Get an output, as a Promise!
      return { foo };
    },
    { foo: "bar", bar: "baz" }
  );

  console.log("simple function", result);
}
simpleFunctionGraph();

async function customAction() {
  const result = await flow(
    (inputs) => {
      return flow(async (inputs) => {
        const { a, b } = await inputs;
        return { result: ((a as number) || 0) + ((b as number) || 0) };
      }, inputs);
    },
    { a: 1, b: 2 }
  );

  console.log("custom action", result);
}
customAction();

async function mathImperative() {
  const result = await flow(
    (inputs) => {
      const { prompt } = promptTemplate({
        template:
          "Write Javascript to compute the result for this question:\nQuestion: {{question}}\nCode: ",
        question: inputs.question,
      });
      const { completion } = generateText({
        prompt,
        PALM_KEY: secrets({ keys: ["PALM_KEY"] }),
      });
      const result = runJavascript({ code: completion });
      return result;
    },
    { question: "1+1" }
  );

  console.log("mathImperative", result);
}
mathImperative();

async function mathChainGraph() {
  const result = await flow(
    (inputs) => {
      return promptTemplate({
        template:
          "Write Javascript to compute the result for this question:\nQuestion: {{question}}\nCode: ",
        question: inputs.question,
      })
        .to(generateText({ PALM_KEY: secrets({ keys: ["PALM_KEY"] }) }))
        .completion.as("code")
        .to(runJavascript());
    },
    { question: "1+1" }
  );

  console.log("mathChainGraph", result);
}
mathChainGraph();

async function mathChainDirectly() {
  const result = await passthrough({ question: "1+1" })
    .to(
      promptTemplate({
        template:
          "Write Javascript to compute the result for this question:\nQuestion: {{question}}\nCode: ",
      })
    )
    .to(
      generateText({
        PALM_KEY: secrets({ keys: ["PALM_KEY"] }),
      })
    )
    .completion.as("code")
    .to(runJavascript());

  console.log("mathChainDirectly", result);
}
mathChainDirectly();

async function ifElse() {
  const math = action((inputs) => {
    return promptTemplate({
      template:
        "Write Javascript to compute the result for this question:\nQuestion: {{question}}\nCode: ",
      question: inputs.question,
    })
      .to(generateText({ PALM_KEY: secrets({ keys: ["PALM_KEY"] }) }))
      .completion.as("code")
      .to(runJavascript());
  });

  const search = action((inputs) => {
    // TODO: Implement
    return inputs;
  });

  const result = await flow(
    async (inputs) => {
      const { completion } = await promptTemplate({
        template:
          "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
        question: inputs.question,
      }).to(generateText({ PALM_KEY: secrets({ keys: ["PALM_KEY"] }) }));
      if (completion && (completion as string).startsWith("YES")) {
        return math({ question: inputs.question });
      } else {
        return search(inputs);
      }
    },
    { question: "1+1" }
  );

  console.log("mathChainGraph", result);
}
ifElse();

async function ifElseSerializable() {
  const math = action((inputs) => {
    return promptTemplate({
      template:
        "Write Javascript to compute the result for this question:\nQuestion: {{question}}\nCode: ",
      question: inputs.question,
    })
      .to(generateText({ PALM_KEY: secrets({ keys: ["PALM_KEY"] }) }))
      .completion.as("code")
      .to(runJavascript());
  });

  const search = action((inputs) => {
    // TODO: Implement
    return inputs;
  });

  const result = flow(
    async (inputs) => {
      return promptTemplate({
        template:
          "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
        question: inputs.question,
      })
        .to(generateText({ PALM_KEY: secrets({ keys: ["PALM_KEY"] }) }))
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

  console.log("mathChainGraph", result);
}
ifElseSerializable();
