/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { cp, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { readConfigFromArgv } from "./config.js";
import { generate } from "./generate.js";

const config = readConfigFromArgv(process.argv);
await mkdir(config.outputDir, { recursive: true });

// We don't want the user to need a production dependency on this package just
// so that the generated modules can import "support.ts", because it has large
// dependencies like esbuild. We could have a separate "support" package, but
// then we'd have to tell the user to install that. So, the simplest solution is
// just to copy the support library directly to the user's output folder.
const supportOutputPath = join(config.outputDir, "support.ts");
console.log(`Writing support module to ${supportOutputPath}`);
await cp(
  join(import.meta.dirname, "..", "src", "support.ts"),
  supportOutputPath
);

await Promise.all(
  config.inputPaths.map(async (inputPath) => {
    const generatedModuleSource = await generate(config, inputPath);
    const outputPath = join(config.outputDir, basename(inputPath));
    console.log(`Writing generated module to ${outputPath}`);
    await writeFile(outputPath, generatedModuleSource);
  })
);
