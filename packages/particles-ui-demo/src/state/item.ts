/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ElementType,
  Orientation,
  Presentation,
  SegmentType,
} from "../types/particles.js";

import { signal } from "signal-utils";
import { TodoItem } from "../types/types.js";

export { Item };

function createPresentation(): Presentation {
  const params = new URLSearchParams(window.location.search);
  const vertical = params.get("vertical");

  return {
    type: ElementType.CARD,
    segments: [
      {
        weight: 1.4,
        type: SegmentType.BLOCK,
        fields: {
          static: {
            as: "image",
            title: "Image",
            src: Math.random() > 0.5 ? "images/doggo.jpg" : "images/catto.jpg",
          },
        },
        orientation: Orientation.VERTICAL,
      },
      {
        weight: vertical ? "max-content" : 3,
        type: SegmentType.LIST,
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
        orientation: Orientation.VERTICAL,
      },
      {
        weight: "max-content",
        type: SegmentType.LIST,
        fields: {
          delete: { title: "Delete", as: "behavior", icon: "delete" },
          done: { title: "Done", as: "behavior", icon: "check" },
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
    newItem.presentation = item.presentation;
    return newItem;
  }
}
