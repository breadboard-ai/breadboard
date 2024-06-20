/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import BreadboardManifestJsonSchema from "../bbm.schema.json" assert { type: "json" };
import { BoardResource } from "./types/boards";
import { DereferencedManifest, ManifestResource } from "./types/manifest";

export const BreadboardManifestSchema = BreadboardManifestJsonSchema;

/**
 * A Breadboard Manifest.
 *
 * Contains a list of paths to board files and a list of paths to manifest files.
 *
 * @examples [
 *   {
 *     "title": "Empty Manifest"
 *   },
 *   {
 *     "title": "Manifest with empty lists",
 *     "boards": [],
 *     "manifests": []
 *   },
 *   {
 *     "boards": [
 *       {
 *         "title": "My First Board",
 *         "url": "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
 *         "version": "1.0.0"
 *       },
 *       {
 *         "title": "My Second Board",
 *         "url": "./boards/board.bgl.json"
 *       }
 *     ],
 *     "manifests": [
 *       {
 *         "title": "Gist Manifest",
 *         "url": "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json"
 *       }
 *     ]
 *   },
 *   {
 *     "title": "Manifest with concrete boards",
 *     "boards": [
 *       {
 *         "title": "My First Board",
 *         "nodes": [],
 *         "edges": []
 *       }
 *     ]
 *   }
 * ]
 */
export class BreadboardManifest implements DereferencedManifest {
  $schema?: string = BreadboardManifestJsonSchema.$schema;
  title?: string;
  boards?: BoardResource[];
  manifests?: ManifestResource[];

  constructor(args: DereferencedManifest = {}) {
    this.title = args.title;
    this.boards = args.boards || [];
    this.manifests = args.manifests || [];
  }
}

export * from "./dereference";
export * from "./types";

