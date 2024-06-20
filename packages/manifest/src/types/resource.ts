/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { BoardResource } from "./boards";
import { ManifestResource } from "./manifest";
/**
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
 * @examples [
 * "My First Board",
 * "Gist Manifest"
 * ]
 */
export type Title = string;

/**
 * A reference to a resource.
 */
export type ResourceReference = {
  title?: Title;
  url: UriReference;
};

/**
 * A resource.
 */
export type Resource = BoardResource | ManifestResource;
