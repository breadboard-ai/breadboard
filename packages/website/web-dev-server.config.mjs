/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const PORT = 8000;

console.log(`=========================================`);
console.log(` 🤖 http://localhost:${PORT}/breadboard/ 🤖`);
console.log(`=========================================`);
console.log();

export default {
  watch: false,
  nodeResolve: true,
  rootDir: "dist/prod/",
  esbuildTarget: "auto",
};
