/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentSnapshot, Firestore } from "@google-cloud/firestore";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdir, writeFile } from "fs/promises";
import type { GraphDescriptor } from "@breadboard-ai/types";

dotenv.config();

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const OUT_DIR = join(ROOT_DIR, "out");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function translateGraphDescriptor(graph: GraphDescriptor): GraphDescriptor {
  const url = graph.url;

  // 1) strip thumbnail and splash
  delete graph.assets?.["@@splath"];
  delete graph.assets?.["@@thumbnail"];
  if (graph.assets && Object.keys(graph.assets).length === 0) {
    delete graph.assets;
  }
  // 2) delete URL
  delete graph.url;

  // 3) absolutize theme URLs
  const themes = graph.metadata?.visual?.presentation?.themes || [];
  Object.values(themes).forEach((theme) => {
    const storedData = theme.splashScreen?.storedData;
    if (!storedData) {
      throw new Error(`Invalid relative theme URL in graph ${graph.title}`);
    }
    const relative = storedData.handle;
    const absolute = new URL(relative, url).href;
    storedData.handle = absolute;
  });
  return graph;
}

async function main() {
  const databaseId = process.env["FIRESTORE_DB_NAME"] || "unified-server";
  const database = new Firestore({ databaseId });

  await ensureDir(OUT_DIR);

  (
    await database
      .collectionGroup("boards")
      .where("tags", "array-contains", "featured")
      .get()
  ).forEach((doc: DocumentSnapshot): void => {
    const id = doc.id;
    const graphJson = doc.get("graph");
    const graph = translateGraphDescriptor(JSON.parse(graphJson));
    const title = graph?.title;
    if (!title) {
      throw new Error(`Graph ${id} has no title`);
    }
    console.log("Writing", title);
    writeFile(join(OUT_DIR, title), JSON.stringify(graph, null, 2));
  });
}

main();
