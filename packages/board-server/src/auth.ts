/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage } from "http";

export const getUserKey = (req: IncomingMessage) => {
  const auth = req.headers.authorization;
  if (!auth) {
    return null;
  }

  const [type, token] = auth.split(" ");
  if (type !== "Bearer") {
    return null;
  }

  return token;
};
