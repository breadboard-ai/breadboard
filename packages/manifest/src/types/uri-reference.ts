/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/**
 * URI reference string that identifies a resource by its location.
 * Can be an absolute URL or a relative path.
 *
 * @format uri-reference
 *
 * @examples [
 * "https://gist.githubusercontent.com/user/SOME_ID/raw/something.json",
 * "./file.json",
 * ]
 */
export type UriReference = string;
