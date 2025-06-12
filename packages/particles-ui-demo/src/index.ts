/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receiver } from "./receiver.js";
import { UiReceiver } from "./ui/ui-receiver.js";
import { Generator } from "./generator.js";
import { Generator as Generator2 } from "./generator-2.js";
import { List } from "./ui/elements/list.js";
import { theme } from "./ui/styles/default.js";
import { Item } from "./state/item.js";
import { TodoItem } from "./types/types.js";

const generator = new Generator();
const receiver = new Receiver(generator);
generator.connect(receiver);

const uiReceiver = new UiReceiver();
uiReceiver.receiver = receiver;

document.body.appendChild(uiReceiver);

const params = new URLSearchParams(window.location.search);

if (params.get("cards")) {
  const styles = theme;
  const cards = new List();
  cards.theme = styles;
  document.body.appendChild(cards);
}

if (params.get("g2")) {
  new Generator2({
    async update(update) {
      if ("create" in update) {
        const {
          path: [id],
          item,
        } = update.create;
        receiver.list.items.set(id, Item.from(item));
      } else if ("change" in update) {
        const {
          path: [parentId, id],
          value,
        } = update.change;
        const item = receiver.list.items.get(parentId);
        if (!item) {
          return;
        }
        // ghastly hack!!
        // TODO: Teach Particles about value types, like "boolean".
        if (id === "done") {
          item.done = value === "true";
        } else {
          const field = id as keyof TodoItem;

          Reflect.set(item, field, value);
        }
      } else if ("remove" in update) {
        const {
          path: [id],
        } = update.remove;
        receiver.list.items.delete(id);
      }
    },
  });
}
