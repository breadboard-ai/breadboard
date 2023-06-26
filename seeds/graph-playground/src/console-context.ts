import { log, text } from "@clack/prompts";

import { InputValues, NodeHandlers, OutputValues } from "./graph.js";
import { Logger } from "./logger.js";
import { BaseTraversalContext } from "./traversal.js";

export class ConsoleContext extends BaseTraversalContext {
  logger: Logger;

  constructor(nodeHandles: NodeHandlers) {
    super(nodeHandles);
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
}
