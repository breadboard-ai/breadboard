/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { object } from "@breadboard-ai/build";
import { code, secret } from "@google-labs/core-kit";

export const { headers } = code(
  { token: secret("connection:google-drive") },
  { headers: object({}, "string") },
  ({ token }) => ({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
).outputs;
