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
    type: "list",
    group: new SignalMap(),
  };
}

function createItem(item: TodoItem): Particle {
  const group = new SignalMap([
    ["title", { text: item.title }],
    ["done", { text: JSON.stringify(item.done), mimeType: "application/json" }],
  ]);
  if (item.description) {
    group.set("description", { text: item.description });
  }
  if (item.dueDate) {
    group.set("dueDate", {
      text: JSON.stringify(item.dueDate),
      mimeType: "application/json",
    });
  }
  return { type: "group", group };
}
