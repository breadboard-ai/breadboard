/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Presentation } from "../types/particles.js";

import { signal } from "signal-utils";
import { ItemData, ItemState } from "../types/types.js";

export { Item };

function createPresentation(): Presentation {
  const params = new URLSearchParams(window.location.search);
  const vertical = params.get("vertical");

  return {
    type: "card",
    segments: [
      {
        weight: 1.4,
        type: "block",
        fields: {
          static: {
            as: "image",
            title: "Image",
            src: Math.random() > 0.5 ? "images/doggo.jpg" : "images/catto.jpg",
          },
        },
        orientation: "vertical",
      },
      {
        weight: vertical ? "max-content" : 3,
        type: "list",
        fields: {
          title: {
            title: "Your todo",
            behaviors: ["editable"],
            modifiers: ["hero"],
            as: "text",
          },
          description: {
            title: "Describe the thing (optional)",
            behaviors: ["editable"],
            as: "longtext",
          },
          dueDate: {
            title: "When is this due?",
            behaviors: ["editable"],
            as: "date",
          },
        },
        orientation: "vertical",
      },
      {
        weight: "max-content",
        type: "list",
        fields: {
          delete: { title: "Delete", as: "behavior", icon: "delete" },
          done: { title: "Done", as: "behavior", icon: "check" },
        },
        orientation: vertical ? "horizontal" : "vertical",
      },
    ],
    orientation: vertical ? "vertical" : "horizontal",
    behaviors: ["editable"],
  };
}

class Item implements ItemState {
  @signal
  accessor data: ItemData | undefined = undefined;

  @signal
  accessor presentation: Presentation = createPresentation();

  static from(item: ItemData & { presentation: Presentation }): ItemState {
    const newItem = new Item();
    const { presentation, ...data } = item;
    console.log("ITEM", item);
    newItem.presentation = presentation || createPresentation();
    newItem.data = data;
    return newItem;
  }
}
