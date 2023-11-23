/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "./ui";
import type * as Breadboard from "@google-labs/breadboard";
import { type RunResult, HostRuntime } from "@google-labs/breadboard/worker";
import { ProxyReceiver } from "./receiver.js";

const localBoards = await (await fetch("/local-boards.json")).json();
const PROXY_NODES = [
  "palm-generateText",
  "embedText",
  "secrets",
  "fetch",
  "credentials",
  "driveList",
];
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

export class Main {
  #ui = BreadboardUI.get();
  #runtime = new HostRuntime(WORKER_URL);
  #receiver = new ProxyReceiver();
  #hasActiveBoard = false;

  constructor() {
    BreadboardUI.register();

    this.#ui.addEventListener(
      BreadboardUI.StartEvent.eventName,
      async (evt) => {
        if (this.#hasActiveBoard) {
          if (
            !confirm("You already have an active board. Do you want to change?")
          ) {
            return;
          }
        }
        this.#hasActiveBoard = true;

        const startEvent = evt as BreadboardUI.StartEvent;
        this.#ui.setActiveBreadboard(startEvent.url);

        for await (const result of this.#runtime.run(
          startEvent.url,
          PROXY_NODES
        )) {
          this.#handleEvent(result);
        }
      }
    );

    this.#ui.addEventListener(BreadboardUI.ToastEvent.eventName, (evt) => {
      const toastEvent = evt as BreadboardUI.ToastEvent;
      this.#ui.toast(toastEvent.message, toastEvent.toastType);
    });

    this.#ui.start(config);
  }

  async #handleEvent(result: RunResult) {
    const { data, type } = result.message;
    switch (type) {
      case "load": {
        const loadData = data as BreadboardUI.LoadArgs;
        this.#ui.load(loadData);
        break;
      }

      case "output": {
        const outputData = data as { outputs: BreadboardUI.OutputArgs };
        await this.#ui.output(outputData.outputs);
        break;
      }

      case "input": {
        const inputData = data as {
          node: { id: string };
          inputArguments: BreadboardUI.InputArgs;
        };
        result.reply(
          await this.#ui.input(inputData.node.id, inputData.inputArguments)
        );
        break;
      }

      case "beforehandler": {
        const progressData = data as { node: { id: unknown } };
        this.#ui.progress(`Running "${progressData.node.id}" ...`);
        break;
      }

      case "error": {
        const errorData = data as { error: string };
        this.#ui.error(errorData.error);
        break;
      }

      case "proxy":
        {
          try {
            const proxyData = data as {
              node: Breadboard.NodeDescriptor;
              inputs: Breadboard.InputValues;
            };
            for await (const handledResult of this.#receiver.handle(
              proxyData
            )) {
              const receiverResult = handledResult as {
                type: "secret" | "result";
                name: string;
                value: string | { completion: string };
                nodeType: Breadboard.NodeTypeIdentifier;
              };

              switch (receiverResult.type) {
                case "secret":
                  receiverResult.value = await this.#ui.secret(
                    receiverResult.name
                  );
                  break;
                case "result":
                  if (receiverResult.nodeType === "palm-generateText") {
                    const resultValue = receiverResult.value as {
                      completion: string;
                    };
                    this.#ui.result({
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
            this.#ui.error(err.message);
          }
        }
        break;

      case "end":
        this.#ui.done();
        this.#hasActiveBoard = false;
        break;

      case "shutdown":
        break;
    }
  }
}
