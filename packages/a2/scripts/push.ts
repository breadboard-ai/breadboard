/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Firestore } from "@google-cloud/firestore";
import dotenv from "dotenv";
import { readdir, readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

dotenv.config();

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(MODULE_DIR, "..");
const BGL_DIR = join(ROOT_DIR, "bgl");
const USER_ID = "shared";

const BGL_SUFFIX = ".bgl.json";

function whatToPush(entry: string) {
  if (entry.startsWith("_")) return false;
  if (!entry.endsWith(BGL_SUFFIX)) return false;
  entry = entry.slice(0, -BGL_SUFFIX.length);
  if (entry.endsWith("workbench")) return false;
  if (entry.endsWith("demo")) return false;
  if (entry.endsWith("wip")) return false;
  if (entry.endsWith("old")) return false;
  if (entry.endsWith("test")) return false;
  return true;
}

async function main() {
  const bgls = (await readdir(BGL_DIR)).filter(whatToPush);

  const databaseId = process.env["FIRESTORE_DB_NAME"] || "board-server";
  const database = new Firestore({ databaseId });

  for (const bgl of bgls) {
    const graph = (await readFile(join(BGL_DIR, bgl), "utf-8")).replaceAll(
      "./tools.bgl",
      "../@shared/tools.bgl"
    );
    const descriptor = JSON.parse(graph);
    const {
      title,
      metadata: { tags },
      description,
    } = descriptor;
    if (!tags || tags.includes("experimental")) {
      continue;
    }
    console.log(`Pushing ${bgl}: ${title}, ${tags}, ${description}`);
    await database.doc(`/workspaces/${USER_ID}/boards/${bgl}`).set({
      graph,
      tags,
      title,
      description,
    });
  }
}

main();
