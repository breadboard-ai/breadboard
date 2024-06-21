/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  Edge as GraphEdge,
  Node as GraphNode,
} from "@google-labs/breadboard";
import BreadboardManifestJsonSchema from "../bbm.schema.json" assert { type: "json" };
import { generateSchemaId } from "./scripts/generate";
export const BreadboardManifestSchema = BreadboardManifestJsonSchema;

/**
 * A Breadboard Manifest.
 *
 * Contains references to boards and other manifests.
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
  $schema?: Reference;
  boards?: BoardReference[];
  manifests?: ManifestReference[];
  reference?: Reference;
  title?: Title;
}

export class BreadboardManifestBuilder implements BreadboardManifest {
  readonly $schema?: Reference;
  boards?: BoardReference[];
  readonly reference?: Reference;
  manifests?: ManifestReference[];
  title?: Title;

  constructor(manifest: BreadboardManifest = {}) {
    this.$schema = manifest.$schema;
    this.boards = manifest.boards;
    this.manifests = manifest.manifests;
    this.reference = manifest.reference;
    this.title = manifest.title;
  }

  addBoard(board: BoardReference): void {
    if (!this.boards) {
      this.boards = [];
    }
    this.boards.push(board);
  }

  addboards(boards: BoardReference[]): void {
    boards.forEach(this.addBoard);
  }

  addManifest(manifest: ManifestReference): void {
    if (!this.manifests) {
      this.manifests = [];
    }
    this.manifests.push(manifest);
  }

  addManifests(manifests: ManifestReference[]): void {
    manifests.forEach(this.addManifest);
  }
}

/**
 * The schema ID for the Breadboard Manifest schema.
 */
export const $schema: string = generateSchemaId();

/**
 * A URI reference.
 *
 * @format uri-reference
 *
 * @examples [
 * "https://example.com/board.bgl.json",
 * "https://example.com/manifest.bbm.json",
 * "https://example.com/manifests/manifest.bbm.json",
 * "file:///path/to/board.bgl.json",
 * "file:///path/to/manifest.bbm.json"
 * ]
 */
export type UriReference = string;

/**
 * A reference to a resource relative to the Uri of the parent resource.
 *
 * @pattern ^(\.\/|\.\.\/|[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$
 *
 * @examples [
 * "board.bgl.json",
 * "manifest.bbm.json",
 * "../boards/board.bgl.json",
 * "../manifests/manifest.bbm.json",
 * "./board.bgl.json",
 * "./manifest.bbm.json"
 * ]
 */
export type RelativeReference = string;

/**
 * A reference to a resource.
 */
export type Reference = UriReference | RelativeReference;

/**
 * A resource that definitely has a reference.
 *
 * Also has a title.
 */
export interface ResourceReference extends Resource {
  readonly reference: Reference;
  readonly title?: Title;
}

/**
 * A referenceable resource.
 */
export interface Resource {
  reference?: Reference;
}

/**
 * Allow additional properties.
 */
export type AdditionalProperties = {
  [x: string | number | symbol]: unknown;
};

/**
 * A Resource that allows additional properties.
 */
export interface ResourceWithAdditionalProperties
  extends Resource,
    AdditionalProperties {}

/**
 * A proxy for the {@link GraphDescriptor} {@link GraphNode} type
 */
export interface Node extends AdditionalProperties {}

/**
 * A proxy for the {@link GraphDescriptor} {@link GraphEdge} type
 */
export interface Edge extends AdditionalProperties {}

/**
 * A proxy for the {@link GraphDescriptor} type
 */
export interface Board extends ResourceWithAdditionalProperties {
  title?: Title;
  nodes?: Node[];
  edges?: Edge[];
}

/**
 * Union of {@link ResourceReference} and {@link Board}
 */
export type BoardReference = ResourceReference | Board;
// export interface BoardReference extends ResourceReference, Board {}

/**
 * Union of {@link ResourceReference} and {@link BreadboardManifest}
 */
export type ManifestReference = ResourceReference | BreadboardManifest;
// export interface ManifestReference
//   extends BreadboardManifest,
//     ResourceReference {}

/**
 *
 *
 * @examples [
 * "My First Board",
 * "Gist Manifest"
 * ]
 */
export type Title = string;
