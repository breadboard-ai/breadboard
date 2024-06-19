/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import BreadboardManifestJsonSchema from "../bbm.schema.json" assert { type: "json" };

export const BreadboardManifestSchema = BreadboardManifestJsonSchema;

export type { BoardReference } from "./types/board-reference";
export  { BreadboardManifest } from "./types/breadboard-manifest";
export type { ManifestItem } from "./types/manifest-item";
export type { ManifestReference } from "./types/manifest-reference";

