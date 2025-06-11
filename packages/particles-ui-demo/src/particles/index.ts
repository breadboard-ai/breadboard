/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Particle } from "@breadboard-ai/particles";
import { SignalMap } from "signal-utils/map";
import { TodoItem } from "../types/types.js";

export { createList, createItem };

function createList(): Particle {
  return {
    presentation: ["list"],
    behaviors: ["editable"],
    group: new SignalMap(),
  };
}

function createItem(item: TodoItem): Particle {
  const firstColumnGroup = new SignalMap<string, Particle>([
    [
      "title",
      { text: item.title, behaviors: ["editable"], presentation: ["hero"] },
    ],
  ]);
  if (item.description) {
    firstColumnGroup.set("description", {
      text: item.description,
      behaviors: ["editable"],
    });
  }
  if (item.dueDate) {
    firstColumnGroup.set("dueDate", {
      text: JSON.stringify(item.dueDate),
      mimeType: "application/json",
      behaviors: ["editable"],
    });
  }
  const secondColumnGroup = new SignalMap([
    ["done", { text: JSON.stringify(item.done), mimeType: "application/json" }],
  ]);
  const group = new SignalMap([
    ["column-1", { group: firstColumnGroup, presentation: ["card"] }],
    ["column-2", { group: secondColumnGroup, presentation: ["has-delete"] }],
  ]);
  return { type: "group", group, presentation: ["columns:2"] };
}
