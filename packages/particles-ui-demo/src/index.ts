/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receiver } from "./receiver.js";
import { UiReceiver } from "./ui/ui-receiver.js";
import { Generator } from "./generator-2.js";
import { List } from "./ui/elements/list.js";
import { List as ListState } from "./state/list.js";
import { theme } from "./ui/styles/default.js";
import { Item } from "./state/item.js";
import { TodoItem } from "./types/types.js";
import { GeneratorProxyImpl } from "./generator-proxy.js";

const list = new ListState();

const generator = new Generator({
  async update(update) {
    if ("create" in update) {
      const {
        path: [id],
        item,
      } = update.create;
      list.items.set(id, Item.from(item));
    } else if ("change" in update) {
      const {
        path: [parentId, id],
        value,
      } = update.change;
      const item = list.items.get(parentId);
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
      list.items.delete(id);
    }
  },
});

const generatorProxy = new GeneratorProxyImpl({
  dispatch: async (event) => {
    const { type, path, value } = event;
    if (type === "additem") {
      generator.addItem();
    } else if (type === "updatefield") {
      const [parentId, id] = path;
      if (!value) {
        console.log(`Value is empty for ${parentId}.${id}`);
        return;
      }
      // ghastly hack!!
      // TODO: Teach Particles about value types, like "boolean".
      if (value === "done") {
        generator.updateDone(parentId, JSON.parse(value));
      } else {
        generator.updateField(parentId, id, value);
      }
    } else if (type === "delete") {
      const [id] = path;
      generator.deleteItem(id);
    } else {
      console.warn("Unknown even", event);
    }
  },
});

const receiver = new Receiver(generatorProxy, list);

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
