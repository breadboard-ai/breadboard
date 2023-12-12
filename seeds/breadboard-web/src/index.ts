/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@google-labs/breadboard-ui";
import type * as Breadboard from "@google-labs/breadboard";
import { HostRuntime as HostHarness } from "@google-labs/breadboard/worker";
import { ProxyReceiver } from "./receiver.js";
import { Harness, HarnessRunResult } from "./types.js";
import { MainThreadHarness } from "./main-thread-harness.js";
import { ProxyServerHarness } from "./proxy-server-harness.js";

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

const HARNESS_SWITCH_KEY = "bb-harness";
const MAINTHREAD_HARNESS_VALUE = "main-thread";
const PROXY_SERVER_HARNESS_VALUE = "proxy-server";
const WORKER_HARNESS_VALUE = "worker";

const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL ?? "";
const DEFAULT_HARNESS = PROXY_SERVER_URL
  ? PROXY_SERVER_HARNESS_VALUE
  : WORKER_HARNESS_VALUE;

type PauserCallback = (paused: boolean) => void;
class Pauser extends EventTarget {
  #paused = false;
  #subscribers: PauserCallback[] = [];

  set paused(value: boolean) {
    this.#paused = value;
    this.#notify();
  }

  get paused() {
    return this.#paused;
  }

  #notify() {
    while (this.#subscribers.length) {
      const sub = this.#subscribers.pop();
      if (!sub) {
        break;
      }

      sub.call(null, this.#paused);
    }
  }

  once(callback: () => void) {
    this.#subscribers.push(callback);
  }
}

const sleep = (time: number) =>
  new Promise((resolve) => setTimeout(resolve, time));

export class Main {
  #ui = BreadboardUI.get();
  #harness: Harness;
  #receiver = new ProxyReceiver();
  #hasActiveBoard = false;
  #boardId = 0;
  #delay = 0;
  #pauser = new Pauser();
  #pending = new Map<string, string>();

  constructor(config: BreadboardUI.StartArgs) {
    this.#harness = this.#getHarness();
    BreadboardUI.register();

    document.body.addEventListener(
      BreadboardUI.StartEvent.eventName,
      async (evt: Event) => {
        if (this.#hasActiveBoard) {
          if (
            !confirm("You already have an active board. Do you want to change?")
          ) {
            return;
          }
        }

        if (this.#pauser.paused) {
          // Setting this to false will "unpause" the current board, allowing it
          // to shut down. But we'll switch the pause back on for the new board.
          this.#pauser.paused = false;
          this.#pauser.paused = true;
        }

        this.#hasActiveBoard = true;
        this.#boardId++;

        const startEvent = evt as BreadboardUI.StartEvent;
        this.setActiveBreadboard(startEvent.url);

        for await (const result of this.#harness.run(
          startEvent.url,
          PROXY_NODES
        )) {
          if (
            result.message.type !== "load" &&
            result.message.type !== "beforehandler" &&
            result.message.type !== "shutdown"
          ) {
            const currentBoardId = this.#boardId;
            await this.#suspendIfPaused();
            if (currentBoardId !== this.#boardId) {
              return;
            }
          }
          await sleep(this.#delay);
          await this.#handleEvent(result);
        }
      }
    );

    this.#ui.addEventListener(
      BreadboardUI.ToastEvent.eventName,
      (evt: Event) => {
        const toastEvent = evt as BreadboardUI.ToastEvent;
        this.#ui.toast(toastEvent.message, toastEvent.toastType);
      }
    );

    this.#ui.addEventListener(
      BreadboardUI.DelayEvent.eventName,
      (evt: Event) => {
        const delayEvent = evt as BreadboardUI.DelayEvent;
        this.#delay = delayEvent.duration;
      }
    );

    this.start(config);
  }

  setActiveBreadboard(url: string) {
    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("board", url);
    window.history.replaceState(null, "", pageUrl);

    // Update the board selector.
    document.querySelector("bb-start")?.setAttribute("url", url);
  }

  start(args: BreadboardUI.StartArgs) {
    const header = document.querySelector("header");
    if (!header) {
      return;
    }

    const Start = customElements.get("bb-start");
    if (!Start) {
      console.warn("Start element not defined");
      return;
    }

    const start = new Start(args);
    header.append(start);

    const boardFromUrl = this.#getBoardFromUrl();
    if (boardFromUrl) {
      document.body.dispatchEvent(new BreadboardUI.StartEvent(boardFromUrl));
    } else {
      this.#ui.showIntroContent();
    }
  }

  #getBoardFromUrl() {
    return new URL(window.location.href).searchParams.get("board");
  }

  #hasNodeInfo(data: unknown): data is { node: { id: string } } {
    if (data === null) {
      return false;
    }

    const possibleData = data as { node: { id: string } };
    if ("node" in possibleData) {
      return true;
    }

    return false;
  }

  async #suspendIfPaused(): Promise<void> {
    return new Promise((resolve) => {
      if (this.#pauser.paused) {
        this.#ui.showPaused();
        this.#pauser.once(() => {
          this.#ui.hidePaused();
          resolve();
        });

        return;
      }

      resolve();
    });
  }

  async #handleEvent(result: HarnessRunResult) {
    const { data, type } = result.message;

    if (type === "load") {
      const loadData = data as BreadboardUI.LoadArgs;
      this.#ui.load(loadData);
    }

    // Update the graph to the latest.
    if (this.#hasNodeInfo(data)) {
      await this.#ui.renderDiagram(data.node.id);
    } else {
      await this.#ui.renderDiagram();
    }

    switch (type) {
      case "output": {
        const outputData = data as BreadboardUI.OutputArgs;
        await this.#ui.output(outputData);
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
        const progressData = data as {
          node: {
            id: string;
            type: string;
            configuration: Record<string, unknown> | null;
          };
        };
        this.#ui.progress(progressData.node.id, progressData.node.type);
        this.#pending.set(progressData.node.id, progressData.node.type);
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

            const pending = this.#pending.get(
              proxyData.node.id
            ) as BreadboardUI.HarnessEventType;
            if (pending) {
              this.#pending.delete(proxyData.node.id);
              if (pending !== "secrets") {
                this.#ui.proxyResult(
                  pending,
                  proxyData.node.id,
                  proxyData.inputs
                );
              }
            }

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

  #getHarness() {
    const harness =
      globalThis.localStorage.getItem(HARNESS_SWITCH_KEY) ?? DEFAULT_HARNESS;
    switch (harness) {
      case MAINTHREAD_HARNESS_VALUE: {
        return new MainThreadHarness(async ({ keys }) => {
          if (!keys) return {};
          return Object.fromEntries(
            await Promise.all(
              keys.map(async (key) => [key, await this.#ui.secret(key)])
            )
          );
        });
      }
      case PROXY_SERVER_HARNESS_VALUE: {
        const proxyServerUrl = PROXY_SERVER_URL;
        if (!proxyServerUrl) {
          throw new Error(
            "Unable to initialize proxy server harness. Please provide PROXY_SERVER_URL."
          );
        }
        return new ProxyServerHarness(proxyServerUrl);
      }
      case WORKER_HARNESS_VALUE: {
        return new HostHarness(WORKER_URL);
      }
    }
    throw new Error(`Unknown harness: ${harness}`);
  }
}
