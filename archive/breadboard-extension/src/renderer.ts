/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as Mermaid from "mermaid";

window.addEventListener("message", async (evt) => {
  const main = document.querySelector("main");
  if (!main) {
    return;
  }

  const { svg } = await Mermaid.default.render("chart", evt.data.graph);
  main.innerHTML = svg;
});
