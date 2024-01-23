#!/usr/bin/env node

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "../utils/create.js";
import { stat, readFile, readdir } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Asset = { path: string; contents: string };

const generateAssetList = async (
  dir: string,
  root?: string
): Promise<Asset[]> => {
  if (root == undefined) {
    // On the first iteration, set the base to the root dir.
    root = dir;
  }

  const files = await readdir(dir);
  const assetList: Asset[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const fileStat = await stat(filePath);
    // add file path to asset list if it is a file
    if (fileStat.isFile()) {
      assetList.push({
        path: filePath.substring(root.length + 1), // file is relative to dir.
        contents: await readFile(filePath, { encoding: "utf-8" }),
      });
    }
    // recursively add file paths to asset list if it is a directory
    if (fileStat.isDirectory()) {
      assetList.push(...(await generateAssetList(filePath, root)));
    }
  }

  return assetList;
};

const run = async () => {
  const { name } = await create({
    // optional deps to install
    dependencies: [
      "@google-labs/breadboard",
      "@google-labs/breadboard-cli",
      "@google-labs/template-kit",
      "@google-labs/core-kit",
      "@google-labs/json-kit",
      "@google-labs/palm-kit",
    ], // We can only include deps that have been published.
    // optional dev deps to install
    devDependencies: [
      "@types/node",
      "@typescript-eslint/eslint-plugin",
      "@typescript-eslint/parser",
    ],
    package: {
      main: "./dist/src/index.js",
      type: "module",
      // these will merge with scripts like `test` from `npm init`
      scripts: {
        debug: "npx breadboard debug recipes/ -o recipes/ --watch",
        recipe:
          "npx breadboard run $npm_config_recipe --kit @google-labs/template-kit --kit @google-labs/core-kit --kit @google-labs/json-kit --kit @google-labs/palm-kit",
      },
      files: ["dist/src"],
    },
    files: await generateAssetList(
      path.resolve(__dirname, path.join("..", "..", "..", "assets"))
    ),
    skipGitignore: false,
    skipReadme: true,
  });

  console.log(
    `Created ${name}!. Enter the project directory and run: \`npm run debug\``
  );
};

export { run };
