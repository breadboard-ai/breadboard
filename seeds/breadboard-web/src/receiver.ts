/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { NodeHandlers, OutputValues } from "@google-labs/graph-runner";
import { Starter } from "@google-labs/llm-starter";
import type { ProxyRequestMessage } from "./protocol.js";

const PROXIED_PREFIX = "PROXIED_";

const passProxiedKeys = (keys: string[]) => {
  return keys.reduce((acc, key) => {
    acc[key] = `${PROXIED_PREFIX}${key}`;
    return acc;
  }, {} as OutputValues);
};

class AskForSecret {
  name: string;
  type = "secret";
  value = "";

  constructor(name: string) {
    this.name = name;
  }
}

class FinalResult {
  value: unknown;
  type = "result";

  constructor(value: unknown) {
    this.value = value;
  }
}

/**
 * This receiver is intentionally hacky. A real implementation would
 * also need to pick and choose carefully which requests to execute and how.
 * This is just an illustration of how this might be done.
 */
export class ProxyReceiver {
  board: Board;
  handlers?: NodeHandlers;
  secrets: Record<string, string> = {};

  constructor() {
    this.board = new Board();
    this.board.addKit(Starter);
  }

  async *handle(data: ProxyRequestMessage["data"]) {
    const nodeType = data.node.type;
    const inputs = data.inputs;

    if (!this.handlers)
      this.handlers = await Board.handlersFromBoard(this.board);
    if (nodeType === "secrets") {
      const { keys } = inputs as { keys: string[] };
      yield new FinalResult(passProxiedKeys(keys));
      return;
    }
    for (const name in inputs) {
      let value = inputs[name];
      const s = typeof value === "string" ? value : "";
      if (s.startsWith(PROXIED_PREFIX)) {
        value = this.secrets[name];
        if (!value) {
          const ask = new AskForSecret(name);
          yield ask;
          value = ask.value;
          this.secrets[name] = value;
        }
        inputs[name] = value;
      }
    }
    const handler = this.handlers[nodeType];
    if (!handler)
      throw new Error(`No handler found for node type "${nodeType}".`);
    console.log("handler", inputs);
    yield new FinalResult(await handler(inputs));
  }
}
