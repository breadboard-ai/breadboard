/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UiReceiver } from "./ui/ui-receiver.js";
import { Generator } from "./generator.js";
import { List } from "./state/list.js";
import { Item } from "./state/item.js";
import { TodoItem } from "./types/types.js";
import { GeneratorProxyImpl } from "./generator-proxy.js";
import { createParticles, createSpec } from "./gemini.js";

// const list = new List();
// list.presentation.behaviors.push("editable");

// const generator = new Generator({
//   async update(update) {
//     if ("create" in update) {
//       const {
//         path: [id],
//         item,
//       } = update.create;
//       list.items.set(id, Item.from(item));
//     } else if ("change" in update) {
//       const {
//         path: [parentId, id],
//         value,
//       } = update.change;
//       const item = list.items.get(parentId);
//       if (!item) {
//         console.warn("Trying to modify unknown item", parentId, "field", id);
//         return;
//       }
//       const field = id as keyof TodoItem;

//       Reflect.set(item, field, value);
//     } else if ("remove" in update) {
//       const {
//         path: [id],
//       } = update.remove;
//       list.items.delete(id);
//     }
//   },
// });

// const generatorProxy = new GeneratorProxyImpl({
//   async dispatch(event) {
//     const { type, path, value } = event;
//     if (type === "additem") {
//       generator.addItem();
//     } else if (type === "updatefield") {
//       const [parentId, id] = path;
//       if (!value) {
//         console.log(`Value is empty for ${parentId}.${id}`);
//         return;
//       }
//       generator.updateField(parentId, id, JSON.parse(value));
//     } else if (type === "delete") {
//       const [id] = path;
//       generator.deleteItem(id);
//     } else {
//       console.warn("Unknown even", event);
//     }
//   },
// });

// const { theme } = await import("./ui/theme/default.js");

// const uiReceiver = new UiReceiver();
// uiReceiver.list = list;
// uiReceiver.channel = generatorProxy;
// uiReceiver.theme = theme;
// uiReceiver.colors = theme.colors;

// document.body.appendChild(uiReceiver);

// const s = await createParticles(`Write UI an item in a TODO list.

// The item must have the following fields:
// title, description, dueDate, done, picture

// the picture must be to the left of the title

// The item must include presentation information to convey the following:
// - The done field must be positioned to the right of the other fields
// - The layout of the item`);
const spec = await createSpec(
  `Write UI for an item in a TODO list with pictures`
);
console.log("SPEC", spec);

const code = await createParticles(spec);
console.log("CODE", code);
