/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ElementType,
  Orientation,
  Presentation,
  TodoItem,
} from "../types/types.js";
import { signal } from "signal-utils";

export { Item };

function createPresentation(): Presentation {
  const params = new URLSearchParams(window.location.search);
  const vertical = params.get("vertical");

  return {
    type: ElementType.CARD,
    segments: [
      {
        weight: 1.4,
        type: ElementType.CARD,
        fields: {
          static: {
            as: "image",
            src: Math.random() > 0.5 ? "images/doggo.jpg" : "images/catto.jpg",
          },
        },
        orientation: Orientation.VERTICAL,
      },
      {
        weight: vertical ? "max-content" : 3,
        type: ElementType.LIST,
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
            as: "longstring",
          },
          dueDate: {
            title: "When is this due?",
            behaviors: ["editable"],
            as: "date",
          },
        },
        orientation: Orientation.VERTICAL,
      },
      {
        weight: "max-content",
        type: ElementType.LIST,
        fields: {
          delete: { title: "Delete", as: "behavior" },
          done: { title: "Done", as: "behavior" },
        },
        orientation: vertical ? Orientation.HORIZONTAL : Orientation.VERTICAL,
      },
    ],
    orientation: vertical ? Orientation.VERTICAL : Orientation.HORIZONTAL,
    behaviors: ["editable"],
  };
}

class Item implements TodoItem {
  @signal
  accessor title: string;

  @signal
  accessor done: boolean = false;

  @signal
  accessor description: string | undefined = undefined;

  @signal
  accessor dueDate: Date | undefined = undefined;

  @signal
  accessor presentation: Presentation = createPresentation();

  constructor(title: string) {
    this.title = title;
  }

  static from(item: TodoItem): Item {
    const newItem = new Item(item.title);
    newItem.done = !!item.done;
    newItem.description = item.description;
    newItem.dueDate = item.dueDate;
    return newItem;
  }
}
