/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardRunner,
  InputValues,
  Kit,
  Schema,
  asRuntimeKit,
} from "@google-labs/breadboard";
import { loadBoard, parseStdin, resolveFilePath, watch } from "./lib/utils.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { VerboseLoggingProbe } from "./lib/verbose-logging-probe.js";
import { RunOptions } from "./commandTypes.js";

async function runBoard(
  board: BoardRunner,
  inputs: InputValues,
  kitDeclarations: string[] | undefined,
  verbose: boolean,
  pipedInput = false
) {
  const kits: Kit[] = [];

  if (kitDeclarations != undefined) {
    // We should warn if we are importing code and the associated risks
    for (const kitDetail of kitDeclarations) {
      const kitImport = await import(kitDetail);
      kits.push(asRuntimeKit(kitImport.default));
    }
  }

  const probe = verbose
    ? new VerboseLoggingProbe(async (data) => console.log(data))
    : undefined;

  for await (const stop of board.run({
    kits,
    probe,
  })) {
    if (stop.type === "input") {
      const nodeInputs = stop.inputArguments;
      // we won't mutate the inputs.
      const newInputs = inputs;
      const schema = nodeInputs.schema as Schema;

      /* 
      We will ask for the data if it's not present on the inputs. 
      However we can't ask for prompts if the graph has been piped in.
      */
      if (pipedInput == false && schema != undefined) {
        const rl = readline.createInterface({ input, output });

        if (schema.properties != undefined) {
          const properties = Object.entries(schema.properties);

          for (const [name, property] of properties) {
            if (name in newInputs == false && "default" in property == false) {
              // The required argument is not on the input *and* there is no default. Ask for it.
              const answer = await rl.question(property.description + " ");

              newInputs[name] = answer;
            }
          }
        }

        rl.close();
      }

      stop.inputs = newInputs;
    } else if (stop.type === "output") {
      console.log(stop.outputs);
    }
  }
}

export const run = async (file: string, options: RunOptions) => {
  const kitDeclarations = options.kit as string[] | undefined;
  const verbose = "verbose" in options;
  const input = options.input ? (JSON.parse(options.input) as InputValues) : {};

  if (file != undefined) {
    const filePath = resolveFilePath(file);

    let board = await loadBoard(filePath, options);

    // We always have to run the board once.
    await runBoard(board, input, kitDeclarations, verbose);

    // If we are watching, we need to run the board again when the file changes.
    if ("watch" in options) {
      watch(file, {
        onChange: async () => {
          // Now the board has changed, we need to reload it and run it again.
          board = await loadBoard(filePath, options);
          // We might want to clear the console here.
          await runBoard(board, input, kitDeclarations, verbose);
        },
      });
    }
  } else {
    const stdin = await parseStdin();

    // TODO: What do we do if it's typescript?
    // We should validate it looks like a board...
    const board = await BoardRunner.fromGraphDescriptor(JSON.parse(stdin));

    await runBoard(board, input, kitDeclarations, verbose, true);
  }
};
