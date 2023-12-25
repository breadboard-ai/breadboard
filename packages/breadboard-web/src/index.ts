/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as BreadboardUI from "@google-labs/breadboard-ui";
import {
  type HarnessProxyConfig,
  type HarnessRemoteConfig,
  createHarness,
  HarnessRunResult,
} from "@google-labs/breadboard/harness";
import { asRuntimeKit } from "@google-labs/breadboard";
import Starter from "@google-labs/llm-starter";
import PaLMKit from "@google-labs/palm-kit";
import NodeNurseryWeb from "@google-labs/node-nursery-web";
import Core from "@google-labs/core-kit";
import Pinecone from "@google-labs/pinecone-kit";
import JSONKit from "@google-labs/json-kit";

const PROXY_NODES = [
  "palm-generateText",
  "palm-embedText",
  "secrets",
  "fetch",
  // TODO: These are only meaningful when proxying to main thread,
  //       not anywhere else. Need to figure out what to do here.
  // "credentials",
  // "driveList",
];

const WORKER_URL =
  import.meta.env.MODE === "development" ? "/src/worker.ts" : "/worker.js";

const HARNESS_SWITCH_KEY = "bb-harness";

const PROXY_SERVER_HARNESS_VALUE = "proxy-server";
const WORKER_HARNESS_VALUE = "worker";

const PROXY_SERVER_URL = import.meta.env.VITE_PROXY_SERVER_URL;
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
  #hasActiveBoard = false;
  #boardId = 0;
  #delay = 0;
  #pauser = new Pauser();

  constructor(config: BreadboardUI.StartArgs) {
    // Remove boards that are still works-in-progress from production builds.
    // These boards will have either no version or a version of "0.0.1".
    if (import.meta.env.MODE === "production") {
      config.boards = config.boards.filter(
        (board) => board.version && board.version !== "0.0.1"
      );
    }
    config.boards.sort((a, b) => a.title.localeCompare(b.title));

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

        const harness = this.#getHarness(startEvent.url);

        this.#ui.load(await harness.load());

        for await (const result of harness.run()) {
          if (result.message.type !== "beforehandler") {
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

    const start = new Start() as BreadboardUI.Start;
    start.boards = args.boards;
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

    // Update the graph to the latest.
    if (this.#hasNodeInfo(data)) {
      await this.#ui.renderDiagram(data.node.id);
    } else {
      await this.#ui.renderDiagram();
    }

    switch (type) {
      case "output": {
        await this.#ui.output(data);
        break;
      }

      case "input": {
        result.reply(await this.#ui.input(data.node.id, data.inputArguments));
        break;
      }

      case "secret": {
        const keys = data.keys;
        result.reply(
          Object.fromEntries(
            await Promise.all(
              keys.map(async (key) => [key, await this.#ui.secret(key)])
            )
          )
        );
        break;
      }

      case "beforehandler": {
        this.#ui.beforehandler(data);
        break;
      }

      case "afterhandler": {
        this.#ui.afterhandler(data);
        break;
      }

      case "error": {
        this.#ui.error(data.error.message);
        break;
      }

      case "end":
        this.#ui.done();
        this.#hasActiveBoard = false;
        break;
    }
  }

  #getHarness(url: string) {
    const harness =
      globalThis.localStorage.getItem(HARNESS_SWITCH_KEY) ?? DEFAULT_HARNESS;

    const kits = [
      Starter,
      Core,
      Pinecone,
      PaLMKit,
      NodeNurseryWeb,
      JSONKit,
    ].map((kitConstructor) => asRuntimeKit(kitConstructor));

    const proxy: HarnessProxyConfig[] = [];
    if (harness === PROXY_SERVER_HARNESS_VALUE) {
      proxy.push({
        location: "http",
        url: PROXY_SERVER_URL,
        nodes: PROXY_NODES,
      });
    } else if (harness === WORKER_HARNESS_VALUE) {
      proxy.push({ location: "main", nodes: PROXY_NODES });
    }
    const remote: HarnessRemoteConfig = harness === WORKER_HARNESS_VALUE && {
      type: "worker",
      url: WORKER_URL,
    };
    const diagnostics = true;
    return createHarness({ url, kits, remote, proxy, diagnostics });
  }
}
