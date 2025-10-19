/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { getFileHandle };

let fileCount = 0;

function getFileHandle(ext: string) {
  return `/vfs/video${++fileCount}${ext}`;
}
