/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { readConfigFromArgv } from "./config.js";
import { generate } from "./generate.js";

const config = readConfigFromArgv(process.argv);
await mkdir(config.outputDir, { recursive: true });

await Promise.all(
  config.inputPaths.map(async (inputPath) => {
    const generatedModuleSource = await generate(config, inputPath);
    const outputPath = join(config.outputDir, basename(inputPath));
    console.log(`Writing generated module to ${outputPath}`);
    await writeFile(outputPath, generatedModuleSource);
  })
);
