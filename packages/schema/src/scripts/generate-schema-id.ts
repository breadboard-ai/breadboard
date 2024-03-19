/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from "path";
import packageJson from "../../package.json" assert { type: "json" };
import { ascendToPackageDir } from "./util/ascend-to-package-dir.js";

export function generateSchemaId() {
  const PACKAGE_ROOT = ascendToPackageDir(packageJson.name)
  const SCHEMA_PATH = path.relative(PACKAGE_ROOT, "breadboard.schema.json");

  const GITHUB_OWNER = "breadboard-ai";
  const GITHUB_REPO = "breadboard";
  const GITHUB_REF = `@google-labs/breadboard-schema@${packageJson.version}`;

  const PACKAGE_PATH = "packages/schema";

  const id = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_REF}/${PACKAGE_PATH}/${SCHEMA_PATH}`;
  return id;
}
