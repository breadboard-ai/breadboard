#!/usr/bin/env node

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import create from "base-create";
import * as fs from 'fs';
import * as path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Asset = { path: string, contents: string };

const generateAssetList = (dir: string, base: string): Asset[] => {
  const files = fs.readdirSync(dir);
  const assetList: Asset[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    // add file path to asset list if it is a file
    if (fs.statSync(filePath).isFile()) {
      assetList.push({
        path: filePath.substring(base.length + 1), // file is relative to dir.
        contents: fs.readFileSync(filePath, { encoding: "utf-8" })
      });
    }
    // recursively add file paths to asset list if it is a directory
    if (fs.statSync(filePath).isDirectory()) {
      assetList.push(...generateAssetList(filePath, base));
    }
  }

  return assetList;
};

const { name } = create({
  // optional deps to install
  dependencies: ["@google-labs/breadboard", "@google-labs/llm-starter", "@google-labs/core-kit"], // We can only include deps that have been published.
  // optional dev deps to install
  devDependencies: [
    "@ava/typescript",
    "@esbuild-plugins/node-globals-polyfill",
    // "@google-labs/tsconfig", // Not public
    "@types/node",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "ava",
    "tsx",
    "typescript",
  ],
  package: {
    type: "module",
    main: "./dist/src/index.js",
    description: "A Breadboard Kit",
    types: "./dist/index.d.ts",
    // these will merge with scripts like `test` from `npm init`
    scripts: {
      "build": "FORCE_COLOR=1 tsc --b",
      "test": "FORCE_COLOR=1 ava"
    },
    files: ["dist/src"],
    ava: {
      files: [
        "tests/**/*.ts"
      ],
      typescript: {
        compile: false,
        rewritePaths: {
          "./": "dist/"
        }
      },
      workerThreads: false
    },
  },
  files: generateAssetList(path.resolve(__dirname, "../assets"), path.resolve(__dirname, "../assets")),
  skipGitignore: false,
  skipReadme: true,
});

console.log(`Created ${name}!. Enter the project directory and run: \`npm run build\` and \`npm run test\`.`);