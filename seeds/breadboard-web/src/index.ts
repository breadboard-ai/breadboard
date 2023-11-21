/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@google-labs/breadboard/ui";
import type * as Breadboard from "@google-labs/breadboard";
import { HostRuntime } from "@google-labs/breadboard/worker";
import { ProxyReceiver } from "./receiver.js";

const localBoards = await (await fetch("/local-boards.json")).json();

const WORKER_URL =
  import.meta.env.MODE === "development" ? "/src/worker.ts" : "/worker.js";
const config = {
  boards: [
    {
      title: "Simplest",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/simplest.json",
    },
    {
      title: "Simple meta-reasoning",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/simple-prompt.json",
    },
    {
      title: "Infer a query for retrieval",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/infer-query.json",
    },
    {
      title: "The calculator recipe",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/math.json",
    },
    {
      title: "Accumulating context recipe",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/accumulating-context.json",
    },
    {
      title: "Endless debate",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/endless-debate.json",
    },
    {
      title: "Endless debate with voice",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/endless-debate-with-voice.json",
    },
    {
      title: "Search summarizer",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/search-summarize.json",
    },
    {
      title: "ReAct with slots",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/call-react-with-slot.json",
    },
    {
      title: "ReAct with lambdas",
      url: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/call-react-with-lambdas.json",
    },
    ...localBoards,
  ],
};

BreadboardUI.register();

let isRunning = false;
const ui = BreadboardUI.get();
ui.addEventListener(BreadboardUI.StartEvent.eventName, async (evt) => {
  if (isRunning) {
    return;
  }
  isRunning = true;

  // TODO: Allow board switches.
  const runtime = new HostRuntime(WORKER_URL);
  const receiver = new ProxyReceiver();
  const startEvent = evt as BreadboardUI.StartEvent;

  ui.setActiveBreadboard(startEvent.url);

  for await (const result of runtime.run(startEvent.url, [
    "palm-generateText",
    "embedText",
    "secrets",
    "fetch",
    "credentials",
    "driveList",
  ])) {
    const { data, type } = result.message;
    switch (type) {
      case "load": {
        const loadData = data as BreadboardUI.LoadArgs;
        ui.load(loadData);
        break;
      }

      case "output": {
        const outputData = data as { outputs: BreadboardUI.OutputArgs };
        await ui.output(outputData.outputs);
        break;
      }

      case "input": {
        const inputData = data as {
          node: { id: string };
          inputArguments: BreadboardUI.InputArgs;
        };
        result.reply(
          await ui.input(inputData.node.id, inputData.inputArguments)
        );
        break;
      }

      case "beforehandler": {
        const progressData = data as { node: { id: unknown } };
        ui.progress(`Running "${progressData.node.id}" ...`);
        break;
      }

      case "error": {
        const errorData = data as { error: string };
        ui.error(errorData.error);
        break;
      }

      case "proxy":
        {
          try {
            const proxyData = data as {
              node: Breadboard.NodeDescriptor;
              inputs: Breadboard.InputValues;
            };
            for await (const handledResult of receiver.handle(proxyData)) {
              const receiverResult = handledResult as {
                type: "secret" | "result";
                name: string;
                value: string | { completion: string };
                nodeType: Breadboard.NodeTypeIdentifier;
              };

              switch (receiverResult.type) {
                case "secret":
                  receiverResult.value = await ui.secret(receiverResult.name);
                  break;
                case "result":
                  if (receiverResult.nodeType === "palm-generateText") {
                    const resultValue = receiverResult.value as {
                      completion: string;
                    };
                    ui.result({
                      title: "LLM response",
                      result: resultValue.completion,
                    });
                  }
                  result.reply(receiverResult.value);
                  break;
              }
            }
          } catch (e) {
            const err = e as Error;
            ui.error(err.message);
          }
        }
        break;

      case "end":
        ui.done();
        break;
    }
  }
});

ui.start(config);
