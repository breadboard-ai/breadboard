/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";

const PORT = process.env["PORT"] || "3001";

const app = express();

app.use(express.static("static"));
app.use(express.static("dist/client"));

app.listen(PORT, () => {
  console.log(`opal-shell-server listening on port ${PORT}`);
});
