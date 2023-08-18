import { intro, log, text, outro } from "@clack/prompts";

import {
  Board,
  LogProbe,
  type BreadboardSlotSpec,
} from "@google-labs/breadboard";
import { NodeValue } from "@google-labs/graph-runner";

export const run = async (board: Board, slots: BreadboardSlotSpec) => {
  intro("Hi! I am coffee bot! What would you like to have today?");

  const probe = process.argv.includes("-v") ? new LogProbe() : undefined;

  const ask = async (inputs: Record<string, NodeValue>) => {
    const defaultValue = "<Exit>";
    const message = ((inputs && inputs.message) as string) || "Enter some text";
    const input = (await text({
      message,
      defaultValue,
    })) as string;
    if (input === defaultValue) return { exit: true };
    return { customer: input };
  };

  const stringify = (o: unknown): string => {
    if (typeof o == "string") return o;
    return JSON.stringify(o);
  };

  const show = (outputs: Record<string, NodeValue>) => {
    const { bot, error } = outputs;
    if (error) log.error(stringify(error));
    else log.success(stringify(bot));
  };

  try {
    // Run the board until it finishes. This may run forever.
    for await (const stop of board.run(probe, slots)) {
      if (stop.seeksInputs) {
        stop.inputs = await ask(stop.inputArguments);
      } else {
        show(stop.outputs);
      }
    }

    outro("It was a delight be your coffee bot. See you soon!");
  } catch (e) {
    console.log(e);
    if (e instanceof Error) log.error(e.message);
    outro("Oh no! Something went wrong.");
  }
};
