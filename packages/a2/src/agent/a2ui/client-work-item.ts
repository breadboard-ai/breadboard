import { WorkItem } from "@breadboard-ai/types";
import { Signal } from "signal-polyfill";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";

import { v0_8 } from "@breadboard-ai/a2ui";

export { A2UIClientWorkItem };

const now = new Signal.State(performance.now());

class A2UIClientWorkItem implements WorkItem {
  @signal
  accessor end: number | null = null;

  @signal
  get elapsed(): number {
    const end = this.end ?? now.get();
    return end - this.start;
  }

  #processor = new v0_8.Data.A2UIModelProcessor();

  @signal
  get awaitingUserInput() {
    return false;
  }

  readonly start: number;

  readonly chat = false;

  readonly product: Map<string, { processor: v0_8.Types.ModelProcessor }> =
    new SignalMap();

  constructor(
    public readonly title: string,
    public readonly icon: string
  ) {
    this.start = performance.now();
  }

  renderUserInterface(payload: unknown) {
    if (!Array.isArray(payload)) {
      payload = [payload];
    }

    const messages = payload as v0_8.Types.ServerToClientMessage[];

    this.#processor.processMessages(messages);

    console.log("A2UI Processor v2");

    const surfaceId = crypto.randomUUID();
    this.product.set(surfaceId, { processor: this.#processor });
  }
}
