/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import BreadboardManifestJsonSchema from "../bbm.schema.json" assert { type: "json" };
import { BoardResource } from "./types/boards";
import { DereferencedManifest, ManifestResource } from "./types/manifest";

export const BreadboardManifestSchema = BreadboardManifestJsonSchema;

export class BreadboardManifest implements DereferencedManifest {
  title?: string;
  boards?: BoardResource[];
  manifests?: ManifestResource[];

  constructor(args: DereferencedManifest = {}) {
    this.title = args.title;
    this.boards = args.boards || [];
    this.manifests = args.manifests || [];
  }
}
