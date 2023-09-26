/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const worker = new Worker("/src/worker.ts", { type: "module" });

worker.addEventListener("message", (e) => {
  console.log(e.data);
  const message = e.data;
  if (message.type === "requestSecret") {
    const data = window.localStorage.getItem("PALM_KEY");
    console.log("secret", data);
    worker.postMessage({
      type: "provideSecret",
      data,
    });
  }
});
