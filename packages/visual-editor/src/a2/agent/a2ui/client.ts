/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v0_8 } from "../../../a2ui/index.js";
import {
  JsonSerializable,
  Outcome,
  SimplifiedA2UIClient,
} from "@breadboard-ai/types";
import { A2UIClientEventMessage } from "./schemas.js";
import { FromPidginMessagesResult } from "../pidgin-translator.js";

export { A2UIClient };

class A2UIClient implements SimplifiedA2UIClient {
  get processor(): unknown {
    return this.#processor;
  }

  #userInputPromise: Promise<Outcome<A2UIClientEventMessage>> | null = null;
  #userInputResolver:
    | ((value: Outcome<A2UIClientEventMessage>) => void)
    | null = null;

  #currentRemap: Map<string, string> | undefined;

  readonly receiver = {
    sendMessage: (message: A2UIClientEventMessage) => {
      console.log("EVENT ACTION", message);
      if (!this.#userInputResolver) {
        console.warn(
          `The agent hasn't asked for input yet, this is unexpected, or maybe the user is just clicking buttons before the agent is ready.`
        );
        return;
      }
      this.#userInputResolver(this.#remap(message));
    },
  };

  #processor = v0_8.Data.createSignalA2UIModelProcessor();

  processUpdates(updates: FromPidginMessagesResult) {
    this.#processor.processMessages(updates.messages);
    this.#currentRemap = updates.remap;
  }

  awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    this.#userInputPromise = new Promise((resolve) => {
      this.#userInputResolver = resolve;
    });
    return this.#userInputPromise;
  }

  #remap(message: A2UIClientEventMessage): A2UIClientEventMessage {
    if (!this.#currentRemap) return message;
    const context = message.userAction?.context;
    if (!context) return message;
    const remappedContext = structuredClone(context);
    const remap = this.#currentRemap;

    recursiveRemap(remappedContext);

    return {
      userAction: {
        ...message.userAction!,
        context: remappedContext,
      },
    };

    function recursiveRemap(data: JsonSerializable) {
      if (Array.isArray(data)) {
        data.forEach(recursiveRemap);
      }
      if (typeof data === "object" && data !== null) {
        Object.entries(data).forEach(([key, value]) => {
          if (typeof value === "string") {
            const remappedValue = remap.get(value);
            if (remappedValue) {
              (data as Record<string, string>)[key] = remappedValue;
            }
          } else {
            recursiveRemap(value);
          }
        });
      }
    }
  }
}
