/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UriReference } from "./uriReference";

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
interface ManifestEntry {
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
}

export type { ManifestEntry };
export default ManifestEntry;
