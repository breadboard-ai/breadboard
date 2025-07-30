/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fileURLToPath } from "url";
import { DriveFileQuery, Files } from "./api";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { readFile } from "fs/promises";
import { GraphDescriptor } from "@breadboard-ai/types";

const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const OUT_DIR = join(ROOT_DIR, "out");

dotenv.config();

async function getIds(folderId: string, apiKey: string) {
  const api = new Files({ kind: "key", key: apiKey });

  const query =
    `"${folderId}" in parents` +
    ` and mimeType="${GRAPH_MIME_TYPE}"` +
    ` and trashed=false`;

  const response = await fetch(api.makeQueryRequest(query));
  const folder: DriveFileQuery = await response.json();

  return folder.files.map((file) => ({ id: file.id, name: file.name }));
}

async function main() {
  // 1) Get all the necessary information

  const accessToken = process.env.ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("Set ACCESS_TOKEN env variable");
  }
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("Set DRIVE_FOLDER_ID env variable");
  }

  const apiKey = process.env.DRIVE_API_KEY;
  if (!apiKey) {
    throw new Error("Set DRIVE_API_KEY env variable");
  }

  // 2) Read folder contents and get ids.
  const items = await getIds(folderId, apiKey);

  // 3) Find respective graph in `out` and identify themes.
  const files: { id: string; url: string }[] = [];
  for (const item of items) {
    let graph: GraphDescriptor;
    try {
      graph = JSON.parse(
        await readFile(`${OUT_DIR}/${item.name}`, "utf-8")
      ) as GraphDescriptor;
    } catch (e) {
      console.log(`Skipping "${item.name}"`);
      continue;
    }
    console.log(`Processing "${item.name}"`);
    const presentation = graph.metadata?.visual?.presentation;
    if (!presentation) {
      throw new Error(`Unable to find presentation in "${item.name}"`);
    }
    const current = presentation.theme;
    if (!current) {
      throw new Error(`Unable to find current item in "${item.name}`);
    }
    const splash = presentation.themes?.[current];
    const url = splash?.splashScreen?.storedData.handle;
    if (!url) {
      throw new Error(`Unable to find splash URL in "${item.name}"`);
    }
    files.push({ id: item.id, url });
  }

  // 4) Update metadata on each Drive file
  const api = new Files({ kind: "bearer", token: accessToken });
  for (const file of files) {
    const result = await fetch(
      api.makePatchMetadataRequest(file.id, {
        properties: {
          thumbnailUrl: file.url,
        },
      })
    );
    if (!result.ok) {
      console.error(await result.text());
      throw new Error(result.statusText);
    }
  }
}

main();
