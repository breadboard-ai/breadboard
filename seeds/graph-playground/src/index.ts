/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, log, note, outro, text } from "@clack/prompts";
import { config } from "dotenv";

import { OutputValues, InputValues } from "@google-labs/graph-runner";
import { Board, type ProbeEvent } from "@google-labs/breadboard";
import {
  GraphIntegrityValidator,
  GraphIntegrityPolicy,
  Label,
  LabelLattice,
} from "@google-labs/graph-integrity";

import { ReActHelper } from "./react.js";

// buffer for input from an external source.
let input_buffer: string | null = null;

// Exported as a function so that input can be passed in.
// This is used for running graph-playground from Python.
function pass_in_input(value: string) {
  input_buffer = value;
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

const wait_for_input = async (message: string) => {
  console.log(message);
  while (input_buffer === null) {
    await delay(100);
    await wait_for_input;
  }
  const output = input_buffer;
  input_buffer = null;
  return output;
};

async function main(args: string[], use_input_handler = false) {
  // Parse arguments. Redo with a library once it gets more complex. Example:
  // npm run dev graphs/simplest.json -- --validate-integrity --log-integrity-labels
  const graph = args[0];
  const validateIntegrity = args.includes("--validate-integrity");
  const logIntegrityLabels = args.includes("--log-integrity-labels");

  // Load the environment variables from `.env` file.
  // This is how the `secrets` node gets ahold of the keys.
  config();

  const ask = async (inputs: InputValues): Promise<OutputValues> => {
    const defaultValue = "<Exit>";
    const message = ((inputs && inputs.message) as string) || "Enter some text";
    const input = (use_input_handler) ? await wait_for_input(message) :
    await text({
      message,
      defaultValue,
    });
    if (input === defaultValue) return { exit: true };
    return { text: input } as OutputValues;
  };

  // Line-wrapping magic courtesy of
  // https://stackoverflow.com/questions/14484787/wrap-text-in-javascript
  // Wrap lines neatly for clack.
  const wrap = (s: string) => {
    const cols = (process.stdout.columns || 80) - 10;
    return s.replace(
      new RegExp(`(?![^\\n]{1,${cols}}$)([^\\n]{1,${cols}})\\s`, "g"),
      "$1\n"
    );
  };

  const show = (outputs: OutputValues) => {
    const { text } = outputs;
    if (typeof text == "string") log.success(wrap(text));
    else log.success(JSON.stringify(text));
  };

  // Use Breadboard probe feature to create a nice note in CLI for
  // every text completion.
  const probe = new EventTarget();
  probe.addEventListener("node", (event: Event) => {
    const { detail } = event as ProbeEvent;
    if (logIntegrityLabels && detail.validatorMetadata?.length) {
      const label = detail.validatorMetadata.map((m) => m.description).join(", ");
      note(
        `Integrity label for ${detail.descriptor.id} in ${[
          ...(detail.sources || []),
          "root",
        ]
          .reverse()
          .join("->")}: ${label}`,
        "integrity"
      );
    }
    if (detail.descriptor.type !== "generateText") return;
    const value = (detail?.outputs?.completion as string) || "empty response";
    note(wrap(value), "text completion");
  });

  intro("Let's traverse a graph!");

  // Load the board, specified in the command line.
  const board = await Board.load(graph);

  // Add a custom kit.
  board.addKit(ReActHelper);

  if (validateIntegrity) {
    const lattice = new LabelLattice();
    const policy = {
      fetch: {
        outgoing: {
          response: new Label({ integrity: lattice.UNTRUSTED }),
        },
      },
      runJavascript: {
        incoming: {
          code: new Label({ integrity: lattice.TRUSTED }),
          name: new Label({ integrity: lattice.TRUSTED }),
        },
      },
    } as GraphIntegrityPolicy;

    const validator = new GraphIntegrityValidator();
    validator.addPolicy(policy);

    board.addValidator(validator);
  }

  try {
    // Run the board until it finishes. This may run forever.
    for await (const result of board.run(probe)) {
      if (result.seeksInputs) {
        result.inputs = await ask(result.inputArguments);
      } else {
        show(result.outputs);
      }
    }

    outro("Awesome work! Let's do this again sometime.");
  } catch (e) {
    if (e instanceof Error) log.error(e.message);
    outro("Oh no! Something went wrong.");
  }
}

// Run if not imported from bridge.
if ((process.argv[1]) && !((process.argv[1]).includes("bridge.js"))) {
  const args = process.argv.slice(2);
  main(args);
}
export {main, pass_in_input};