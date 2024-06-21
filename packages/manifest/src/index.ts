/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import BreadboardManifestJsonSchema from "../bbm.schema.json" assert { type: "json" };
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
export interface BreadboardManifest extends Resource {
  title?: Title;
  boards?: BoardReference[];
  manifests?: ManifestReference[];
}

/**
 * A URI reference.
 *
 * @format uri-reference
 * @examples [
 * "board.bgl.json",
 * "manifest.bbm.json",
 * "../boards/board.bgl.json",
 * "../manifests/manifest.bbm.json",
 * "./board.bgl.json",
 * "./manifest.bbm.json",
 * "https://example.com/board.bgl.json",
 * "https://example.com/manifest.bbm.json"
 * ]
 */
export type UriReference = string;

/**
 * A reference to a resource relative to the Uri of the parent resource.
 * @pattern ^(\.\/|\.\.\/|[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$
 */
export type RelativeReference = string;

/**
 * A reference to a resource.
 */
export type Reference = UriReference | RelativeReference;

export class ResourceReference {
  readonly reference: Reference;
  constructor(args: ResourceReference) {
    this.reference = args.reference;
  }
}

export interface Resource {
  reference?: Reference;
}

/**
 * Allow additional properties.
 */
export type AdditionalProperties = {
  [x: string | number | symbol]: unknown;
};

export interface ResourceWithAdditionalProperties
  extends Resource,
    AdditionalProperties {}

export type Node = {};
export type Edge = {};

export interface Board extends ResourceWithAdditionalProperties {
  title?: Title;
  nodes?: Node[];
  edges?: Edge[];
}

// export interface BoardReference extends ResourceReference, Board {}
export type BoardReference = ResourceReference | Board;

// export interface ManifestReference
//   extends BreadboardManifest,
//     ResourceReference {}
export type ManifestReference = ResourceReference | BreadboardManifest;

/**
 * @examples [
 * "My First Board",
 * "Gist Manifest"
 * ]
 */
export type Title = string;
