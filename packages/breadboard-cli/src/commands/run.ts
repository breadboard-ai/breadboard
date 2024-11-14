/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  InputValues,
  Kit,
  Schema,
  asRuntimeKit,
  runGraph,
} from "@google-labs/breadboard";
import { loadBoard, parseStdin, resolveFilePath, watch } from "./lib/utils.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { VerboseLoggingProbe } from "./lib/verbose-logging-probe.js";
import { RunOptions } from "./commandTypes.js";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "url";
import {
  HTTPClientTransport,
  ProxyClient,
} from "@google-labs/breadboard/remote";

async function runBoard(
  board: GraphDescriptor,
  inputs: InputValues,
  kits: Kit[],
  verbose: boolean,
  pipedInput = false
) {
  const probe = verbose
    ? new VerboseLoggingProbe(async (data) => console.log(data))
    : undefined;

  for await (const stop of runGraph(
    { graph: board },
    {
      kits,
      probe,
    }
  )) {
    if (stop.type === "input") {
      const nodeInputs = stop.inputArguments;
      // we won't mutate the inputs.
      const newInputs = { ...inputs };
      const schema = nodeInputs.schema as Schema;

      /* 
      We will ask for the data if it's not present on the inputs. 
      However we can't ask for prompts if the graph has been piped in.
      */
      if (pipedInput == false) {
        const rl = readline.createInterface({ input, output });

        if (schema != undefined && schema.properties != undefined) {
          const properties = Object.entries(schema.properties);
          const required = schema.required || [];

          for (const [name, property] of properties) {
            if (name in newInputs == false) {
              // There is no input being passed in already.
              let answer;
              if (required.indexOf(name) >= 0) {
                // The argument is *required*, even if there is a default ask for it.
                answer = await rl.question(
                  `(${name}) ${property.description}:`
                );
              } else {
                answer = property.default;
              }

              newInputs[name] = answer;
            }
          }
          stop.inputs = newInputs;
        }

        rl.close();
      }
    } else if (stop.type === "output") {
      console.log(stop.outputs);
    }
  }
}

const loadInputFile = async (filePath: string): Promise<InputValues> => {
  const fileUrl = pathToFileURL(filePath);

  return JSON.parse(
    await readFile(fileUrl.pathname, { encoding: "utf-8" })
  ) as InputValues;
};

export const run = async (file: string, options: RunOptions) => {
  const proxy = options.proxy as string | undefined;
  const kitDeclarations = options.kit as string[] | undefined;
  const proxyNodeDeclarations = options.proxyNode as string[] | undefined;
  const verbose = "verbose" in options;
  const optionsInput = options.input
    ? (JSON.parse(options.input) as InputValues)
    : {};

  const input = options.inputFile
    ? { ...(await loadInputFile(options.inputFile)), ...optionsInput } // Allow merging of input file and CLI input
    : optionsInput;

  const kits: Kit[] = [];

  if (kitDeclarations != undefined) {
    // We should warn if we are importing code and the associated risks
    for (const kitDetail of kitDeclarations) {
      const kitImport = await import(kitDetail);
      kits.push(asRuntimeKit(kitImport.default));
    }
  }

  if (
    proxy != undefined &&
    ("proxyNode" in options == false || options.proxyNode.length == 0)
  ) {
    throw new Error(
      "You must specify at least one proxy node if you are using a proxy."
    );
  }

  if (proxy != undefined && proxyNodeDeclarations != undefined) {
    // We should warn if we are importing code and the associated risks
    const client = new ProxyClient(new HTTPClientTransport(proxy));
    kits.unshift(client.createProxyKit(proxyNodeDeclarations));
  }

  if (file != undefined) {
    const filePath = resolveFilePath(file);

    let board = await loadBoard(filePath, options);
    if (!board) {
      return;
    }

    // We always have to run the board once.
    await runBoard(board, input, kits, verbose);

    // If we are watching, we need to run the board again when the file changes.
    if ("watch" in options) {
      watch(file, {
        onChange: async () => {
          // Now the board has changed, we need to reload it and run it again.
          board = await loadBoard(filePath, options);
          if (!board) {
            return;
          }
          // We might want to clear the console here.
          await runBoard(board, input, kits, verbose);
        },
      });
    }
  } else {
    const stdin = await parseStdin();

    // TODO: What do we do if it's typescript?
    // We should validate it looks like a board...
    const board = JSON.parse(stdin);

    await runBoard(board, input, kits, verbose, true);
  }
};
