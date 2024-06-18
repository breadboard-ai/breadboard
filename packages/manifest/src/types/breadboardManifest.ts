/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import BoardEntry from "./boardEntry";
import ManifestEntry from "./manifestEntry";
import { UriReference } from "./uriReference";

/**
 * A Breadboard Manifest.
 *
 * Contains a list of paths to board files and a list of paths to manifest files.
 *
 * @examples
 * [
 *  {
 *    "boards": [],
 *    "manifests": []
 *  },
 *  {
 *    "boards": [
 *      {
 *        "title": "My First Board",
 *        "url": "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
 *        "version": "1.0.0"
 *      },
 *      {
 *        "title": "My Second Board",
 *        "url": "./boards/board.bgl.json"
 *      }
 *    ],
 *    "manifests": [
 *      {
 *        "title": "Gist Manifest",
 *        "url": "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json"
 *      }
 *    ]
 *  }
 * ]
 */
interface BreadboardManifest {
  /**
   * JSON schema
   */
  $schema?: UriReference;

  /**
   * Title of the manifest.
   */
  title?: string;

  /**
   * An array of references to Breadboard Board files.
   *
   *  @see {BoardEntry}
   */
  boards?: BoardEntry[];

  /**
   * An array of references to Breadboard Board Manifests.
   *
   * @see {ManifestEntry}
   */
  manifests?: ManifestEntry[];
}

export type { BreadboardManifest };
export default BreadboardManifest;
