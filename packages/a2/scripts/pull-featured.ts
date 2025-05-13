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

dotenv.config();

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const OUT_DIR = join(ROOT_DIR, "out");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
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
    const graph = graphJson ? JSON.parse(graphJson) : undefined;
    console.log("Writing", graph.title);
    writeFile(join(OUT_DIR, `${id}.bgl.json`), JSON.stringify(graph, null, 2));
  });
}

main();
