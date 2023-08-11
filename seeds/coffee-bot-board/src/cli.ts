import { intro, log, text, outro } from "@clack/prompts";

import { Board, LogProbe } from "@google-labs/breadboard";

export const run = async (board: Board) => {
  intro("Hi! I am coffee bot! What would you like to have today?");

  const probe = process.argv.includes("-v") ? new LogProbe() : undefined;

  const ask = async (inputs: Record<string, unknown>) => {
    const defaultValue = "<Exit>";
    const message = ((inputs && inputs.message) as string) || "Enter some text";
    const input = await text({
      message,
      defaultValue,
    });
    if (input === defaultValue) return { exit: true };
    return { customer: input };
  };
  const show = (outputs: Record<string, unknown>) => {
    const { bot } = outputs;
    if (typeof bot == "string") log.success(bot);
    else log.success(JSON.stringify(bot));
  };

  try {
    // Run the board until it finishes. This may run forever.
    for await (const stop of board.run(probe)) {
      if (stop.seeksInputs) {
        stop.inputs = await ask(stop.inputArguments);
      } else {
        show(stop.outputs);
      }
    }

    outro("Awesome work! Let's do this again sometime.");
  } catch (e) {
    console.log(e);
    if (e instanceof Error) log.error(e.message);
    outro("Oh no! Something went wrong.");
  }
};
