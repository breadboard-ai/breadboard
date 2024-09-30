/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolve } from "node:path";

export interface Config {
  inputPaths: string[];
  outputDir: string;
  tsconfigPath: string;
}

export function readConfigFromArgv(argv: string[]): Config {
  const config: Config = {
    inputPaths: [],
    outputDir: "",
    tsconfigPath: "",
  };
  const seenFlags = new Set<string>();
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--")) {
      const [flagName, flagValue] = arg.slice(2).split("=", 2);
      if (!flagName || !flagValue) {
        throw new Error(`Invalid flag: ${arg}`);
      }
      if (seenFlags.has(flagName)) {
        throw new Error(`--${flagName} can only be specified once`);
      }
      seenFlags.add(flagName);
      if (flagName === "out") {
        config.outputDir = resolve(flagValue);
      } else if (flagName === "tsconfig") {
        config.tsconfigPath = resolve(flagValue);
      } else {
        throw new Error(`Unknown flag: ${flagName}`);
      }
    } else {
      config.inputPaths.push(resolve(arg));
    }
  }
  if (!config.outputDir) {
    throw new Error("--out is required");
  }
  if (!config.tsconfigPath) {
    throw new Error("--tsconfig is required");
  }
  if (config.inputPaths.length === 0) {
    throw new Error("At least one input file is required");
  }
  return config;
}
