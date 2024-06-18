/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type * as types from "./types";
export type {
  BoardEntry,
  BreadboardManifest,
  ManifestEntry,
  BreadboardManifest as default,
} from "./types";
export type { BreadboardManifestJsonSchema };
import BreadboardManifestJsonSchema from "../bbm.schema.json" assert { type: "json" };

export const BreadboardManifestSchema = BreadboardManifestJsonSchema;
