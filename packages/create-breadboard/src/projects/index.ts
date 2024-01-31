#!/usr/bin/env node

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from "../utils/create.js";
import { stat, readFile, readdir } from "fs/promises";
import * as path from "path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type Asset = { path: string; contents: string };

const generateAssetList = async (
  dir: string,
  root?: string,
  skip: string[] = []
): Promise<Asset[]> => {
  if (root == undefined) {
    // On the first iteration, set the base to the root dir.
    root = dir;
  }

  const skipSet = new Set(skip);
  const files = await readdir(dir);
  const assetList: Asset[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (skipSet.has(path.basename(filePath))) {
      continue;
    }
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
    // We use the "hello-world" package (which is a published dependency of
    // "create-breadboard") as the template for the user's new project.
    files: await generateAssetList(
      path.dirname(
        require.resolve("@google-labs/breadboard-hello-world/package.json")
      ),
      undefined,
      // We don't want to copy these files.
      ["node_modules", "CHANGELOG.md"]
    ),
    // Fields to override from the "hello-world" package.json.
    package: {
      version: "1.0.0",
      author: "Your Name Here",
      private: true,
      publishConfig: undefined,
    },
    skipGitignore: false,
    skipReadme: true,
  });

  console.log(
    `Created ${name}!. Enter the project directory and run: \`npm run dev\``
  );
};

export { run };
