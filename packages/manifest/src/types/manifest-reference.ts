/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UriReference } from "./uri-reference";

/**
 * Reference to another manifest file.
 *
 * @see BreadboardManifest
 * @examples [
 * {
 *  "title": "Gist Breadboard Manifest",
 *  "url": "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json"
 * }
 * ]
 */
export interface ManifestReference {
  /**
   * Breadboard Board Manifest Name
   *
   * @examples [ "Gist Manifest" ]
   */
  title?: string;

  /**
   * URI reference to the manifest file.
   *
   * Can be an absolute URL or a relative path.
   *
   * @examples [
   * "https://gist.githubusercontent.com/user/SOME_ID/raw/something.bbm.json",
   * "./manifests/manifest.bbm.json"
   * ]
   */
  url: UriReference;

  /**
   * This field is dissallowed becuase this is a reference to another manifest.
   */
  boards?: never;

  /**
   * This field is dissallowed becuase this is a reference to another manifest.
   */
  manifests?: never;
}
