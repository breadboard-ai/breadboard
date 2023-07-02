import { log, text, note } from "@clack/prompts";

import type {
  InputValues,
  NodeHandlers,
  OutputValues,
  GraphTraversalContext,
  LogData,
  GraphDescriptor,
} from "@google-labs/graph-runner";
import { Logger } from "./logger.js";

export class ConsoleContext implements GraphTraversalContext {
  logger: Logger;
  #graph?: GraphDescriptor;

  constructor(public handlers: NodeHandlers) {
    const root = new URL("../../", import.meta.url);
    this.logger = new Logger(`${root.pathname}/experiment.log`);
    this.log = this.log.bind(this);
  }

  async log(data: LogData): Promise<void> {
    // Let's get a bit clever with the logging here.
    // When the data is an output from completion, we'll log it as a pretty
    // @clack/prompts note.
    if (data.type === "output" && data.key === "completion") {
      note(JSON.parse(data.value as string), "text completion");
    }
    this.logger.log(JSON.stringify(data, null, 2));
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
    const { text } = inputs;
    if (typeof text == "string") log.success(text);
    else log.success(JSON.stringify(text));
  }

  async requestSlotOutput(
    _slot: string,
    _args: InputValues
  ): Promise<OutputValues> {
    throw new Error(
      "Requesting slot output is not supported in the console context"
    );
  }

  async setCurrentGraph(graph: GraphDescriptor): Promise<void> {
    this.#graph = graph;
  }

  async getCurrentGraph(): Promise<GraphDescriptor> {
    return this.#graph as GraphDescriptor;
  }
}
