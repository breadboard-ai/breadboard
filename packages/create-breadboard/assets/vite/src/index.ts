/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@google-labs/breadboard-ui";
import type * as Breadboard from "@google-labs/breadboard";
import { HostRuntime } from "@google-labs/breadboard/worker";
import { ProxyReceiver } from "./receiver.js";
import { Runtime, RuntimeRunResult } from "./types.js";
import { MainThreadRuntime } from "./main-thread-runtime.js";

const localBoards = await (await fetch("/local-boards.json")).json();
const PROXY_NODES = [
  "embedText",
  "secrets",
  "fetch",
  "credentials",
];
const WORKER_URL =
  import.meta.env.MODE === "development" ? "/src/worker.ts" : "/worker.js";
const config = {
  boards: [
    ...localBoards,
  ],
};

const RUNTIME_SWITCH_KEY = "bb-runtime";
const MAINTHREAD_RUNTIME_VALUE = "main-thread";

export class Main {
  #ui = BreadboardUI.get();
  #runtime: Runtime;
  #receiver = new ProxyReceiver();
  #hasActiveBoard = false;
  #boardId = 0;

  constructor() {
    this.#runtime = this.#getRuntime();
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
        this.#boardId++;

        const startEvent = evt as BreadboardUI.StartEvent;
        this.#ui.setActiveBreadboard(startEvent.url);

        for await (const result of this.#runtime.run(
          startEvent.url,
          PROXY_NODES
        )) {
          await this.#handleEvent(result);
        }
      }
    );

    this.#ui.addEventListener(BreadboardUI.ToastEvent.eventName, (evt) => {
      const toastEvent = evt as BreadboardUI.ToastEvent;
      this.#ui.toast(toastEvent.message, toastEvent.toastType);
    });

    this.#ui.start(config);
  }

  async #handleEvent(result: RuntimeRunResult) {
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

            // Track the board ID. If it changes while awaiting a result, then
            // the board has changed and the handled result should be discarded
            // as it is stale.
            const boardId = this.#boardId;
            for await (const handledResult of this.#receiver.handle(
              proxyData
            )) {
              if (boardId !== this.#boardId) {
                console.log("Board has changed; proxy result is stale");
                break;
              }

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
                      title: "LLM Response",
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

  #getRuntime() {
    const runtime = globalThis.localStorage.getItem(RUNTIME_SWITCH_KEY);
    switch (runtime) {
      case MAINTHREAD_RUNTIME_VALUE:
        return new MainThreadRuntime(async ({ keys }) => {
          if (!keys) return {};
          return Object.fromEntries(
            await Promise.all(
              keys.map(async (key) => [key, await this.#ui.secret(key)])
            )
          );
        });
    }
    return new HostRuntime(WORKER_URL);
  }
}
