/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const worker = new Worker("/src/worker.ts", { type: "module" });

const pre = document.body.appendChild(document.createElement("pre"));

const log = (...args: unknown[]) => {
  pre.append(...args.map((arg) => JSON.stringify(arg, null, 2)), "\n");
};

worker.addEventListener("message", (e) => {
  log(e.data);
  const message = e.data;
  if (message.type === "secret") {
    const data = window.localStorage.getItem("PALM_KEY");
    log("secret", data);
    worker.postMessage({
      type: "secret",
      data,
    });
  }
});
