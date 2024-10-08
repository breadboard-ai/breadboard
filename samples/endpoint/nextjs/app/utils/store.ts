/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { StoryType } from "../types";
import { readFile, writeFile } from "fs/promises";

const MODULE_DIR = new URL(import.meta.url).pathname;
const ROOT_DIR = path.resolve(MODULE_DIR, "../../../");
const STORE_DIR = path.resolve(ROOT_DIR, "store");

export async function getStory(id: string): Promise<StoryType | null> {
  if (!isUUID(id)) {
    return null;
  }
  try {
    const story = await readFile(storyFilename(id), "utf-8");
    return JSON.parse(story);
  } catch (e) {
    return null;
  }
}

export async function storeStory(story: StoryType): Promise<string> {
  const id = crypto.randomUUID();
  const storyToWrite = {
    ...story,
    id,
  };
  await writeFile(storyFilename(id), JSON.stringify(storyToWrite));
  return id;
}

export async function getImage(id: string): Promise<Buffer | null> {
  if (!isUUID(id)) {
    return null;
  }

  try {
    const image = await readFile(imageFilename(id));
    return image;
  } catch (e) {
    return null;
  }
}

export async function storeImage(image: Buffer): Promise<string> {
  const id = crypto.randomUUID();

  await writeFile(imageFilename(id), image);
  return id;
}

function imageFilename(id: string): string {
  return `${STORE_DIR}/images/${id}.png`;
}

function storyFilename(id: string): string {
  return `${STORE_DIR}/stories/${id}.json`;
}

function isUUID(input: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}
