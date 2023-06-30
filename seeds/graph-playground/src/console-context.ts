import { log, text } from "@clack/prompts";

import type {
  InputValues,
  NodeHandlers,
  OutputValues,
  GraphTraversalContext,
} from "@google-labs/graph-runner";
import { Logger } from "./logger.js";

export class ConsoleContext implements GraphTraversalContext {
  logger: Logger;

  constructor(public handlers: NodeHandlers) {
    const root = new URL("../../", import.meta.url);
    this.logger = new Logger(`${root.pathname}/experiment.log`);
    this.log = this.log.bind(this);
  }

  log(s: string) {
    this.logger.log(s);
  }

  async requestExternalInput(inputs: InputValues): Promise<OutputValues> {
    const defaultValue = "<Exit>";
    const message = ((inputs && inputs.message) as string) || "Enter some text";
    const input = await text({
      message,
      defaultValue,
    });
    if (input === defaultValue) return { exit: true };
    return { text: input };
  }

  async provideExternalOutput(inputs: InputValues): Promise<void> {
    if (!inputs) return;
    log.step(JSON.stringify(inputs["text"]));
  }

  async requestSlotOutput(
    _slot: string,
    _args: InputValues
  ): Promise<OutputValues> {
    throw new Error(
      "Requesting slot output is not supported in the console context"
    );
  }
}
