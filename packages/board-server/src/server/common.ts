/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage } from "http";

export async function getBody(req: IncomingMessage): Promise<unknown> {
  const chunks: string[] = [];

  return new Promise<unknown>((resolve) => {
    req.on("data", (chunk) => {
      chunks.push(chunk.toString());
    });

    req.on("end", () => {
      const body = chunks.join("");
      if (!body) {
        resolve(undefined);
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(undefined);
      }
    });
  });
}
