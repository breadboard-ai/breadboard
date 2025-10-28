import { Outcome, SimplifiedA2UIClient, WorkItem } from "@breadboard-ai/types";
import { Signal } from "signal-polyfill";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";

import { v0_8 } from "@breadboard-ai/a2ui";
import { A2UIClientEventMessage } from "./schemas";

export { A2UIClientWorkItem };

const now = new Signal.State(performance.now());

type ClientEventMessage = A2UIClientEventMessage;

class A2UIClientWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }

  #userInputPromise: Promise<Outcome<ClientEventMessage>> | null = null;
  #userInputResolver: ((value: Outcome<ClientEventMessage>) => void) | null =
    null;

  #processor = new v0_8.Data.A2UIModelProcessor();

  /**
   * This means something different from us awaiting the user input in the
   * Console vernacular. Here, we always return false for now.
   */
  readonly awaitingUserInput = false;

  readonly start: number;

  readonly chat = false;

  readonly product: Map<string, SimplifiedA2UIClient> = new SignalMap();

  readonly workItemId = crypto.randomUUID();

  constructor(
    public readonly title: string,
    public readonly icon: string
  ) {
    this.start = performance.now();
  }

  awaitUserInput(): Promise<Outcome<ClientEventMessage>> {
    this.#userInputPromise = new Promise((resolve) => {
      this.#userInputResolver = resolve;
    });
    return this.#userInputPromise;
  }

  renderUserInterface(payload: v0_8.Types.ServerToClientMessage[]) {
    this.#processor.processMessages(
      payload as v0_8.Types.ServerToClientMessage[]
    );

    if (this.product.has(this.workItemId)) return;

    this.product.set(this.workItemId, {
      processor: this.#processor,
      receiver: {
        sendMessage: (message: ClientEventMessage) => {
          console.log("EVENT ACTION", message);
          if (!this.#userInputResolver) {
            console.warn(
              `The agent hasn't asked for input yet, this is unexpected, or maybe the user is just clicking buttons before the agent is ready.`
            );
            return;
          }
          this.#userInputResolver(message);
        },
      },
    });
  }
}
