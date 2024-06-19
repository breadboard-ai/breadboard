/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import BreadboardManifestJsonSchema from "../bbm.schema.json" assert { type: "json" };

export const BreadboardManifestSchema = BreadboardManifestJsonSchema;

export type { BoardEntry } from "./types/board-entry";
export type { BreadboardManifest } from "./types/breadboard-manifest";
export type { ManifestItem } from "./types/manifest-item";
export type { ManifestReference } from "./types/manifest-reference";

