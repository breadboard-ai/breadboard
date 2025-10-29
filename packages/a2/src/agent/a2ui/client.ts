/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v0_8 } from "@breadboard-ai/a2ui";
import { Outcome, SimplifiedA2UIClient } from "@breadboard-ai/types";
import { A2UIClientEventMessage } from "./schemas";

export { A2UIClient };

class A2UIClient implements SimplifiedA2UIClient {
  get processor(): unknown {
    return this.#processor;
  }

  #userInputPromise: Promise<Outcome<A2UIClientEventMessage>> | null = null;
  #userInputResolver:
    | ((value: Outcome<A2UIClientEventMessage>) => void)
    | null = null;

  readonly receiver = {
    sendMessage: (message: A2UIClientEventMessage) => {
      console.log("EVENT ACTION", message);
      if (!this.#userInputResolver) {
        console.warn(
          `The agent hasn't asked for input yet, this is unexpected, or maybe the user is just clicking buttons before the agent is ready.`
        );
        return;
      }
      this.#userInputResolver(message);
    },
  };

  #processor = new v0_8.Data.A2UIModelProcessor();

  processUpdates(messages: v0_8.Types.ServerToClientMessage[]) {
    this.#processor.processMessages(messages);
  }

  awaitUserInput(): Promise<Outcome<A2UIClientEventMessage>> {
    this.#userInputPromise = new Promise((resolve) => {
      this.#userInputResolver = resolve;
    });
    return this.#userInputPromise;
  }
}
