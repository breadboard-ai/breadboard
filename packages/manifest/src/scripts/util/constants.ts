/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import { ascendToPackageDir } from "./ascend-to-package-dir";

export const PACKAGE_NAME: string = "@breadboard-ai/manifest" as const;
export const ABSOLUTE_PACKAGE_ROOT: string = ascendToPackageDir(PACKAGE_NAME);
export const SCHEMA_FILE_NAME: string = "bbm.schema.json" as const;
export const ABSOLUTE_PACKAGE_JSON_PATH: string = path.join(
  ABSOLUTE_PACKAGE_ROOT,
  "package.json"
);
export const ABSOLUTE_SCHEMA_PATH: string = path.join(
  ABSOLUTE_PACKAGE_ROOT,
  SCHEMA_FILE_NAME
);
export const HEAD_SCHEMA_FILE_NAME: string = ["head", SCHEMA_FILE_NAME].join(
  "."
);
export const ABSOLUTE_HEAD_SCHEMA_PATH: string = path.join(
  ABSOLUTE_PACKAGE_ROOT,
  HEAD_SCHEMA_FILE_NAME
);

export const GITHUB_OWNER: string = "breadboard-ai" as const;
export const GITHUB_REPO: string = "breadboard" as const;
export const REPO_PACKAGE_PATH: string = "packages/manifest" as const;
