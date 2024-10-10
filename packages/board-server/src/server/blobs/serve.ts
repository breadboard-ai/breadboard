/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from "http";

export { serveBlob };

async function serveBlob(
  blob: string,
  req: IncomingMessage,
  res: ServerResponse
) {
  // ...
}
