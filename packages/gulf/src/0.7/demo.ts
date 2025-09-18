/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as UI from "./ui/ui.js";
import { DataModel } from "./data/model.js";
import { UnifiedUpdate } from "./types/types.js";

function build(model: DataModel | null) {
  if (!model) {
    return;
  }

  const el = new UI.Root();
  el.id = model.data.root.id;
  el.model = model;
  el.components = [model.data.root];
  document.body.appendChild(el);

  console.log(model);
}

(async function main() {
  const data = await import("./data/dog-form.json");
  const model = new DataModel(data.default as UnifiedUpdate);
  build(model);
})();
