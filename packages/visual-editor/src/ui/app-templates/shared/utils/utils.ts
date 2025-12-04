/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorObject } from "@google-labs/breadboard";

export function extractError(err: string | ErrorObject) {
  if (typeof err === "string") {
    return err;
  } else {
    if (typeof err.error === "string") {
      return err;
    } else if (typeof err.error === "object") {
      if ("message" in err.error) {
        return err.error.message;
      }

      return JSON.stringify(err.error, null, 2);
    }

    return "Unknown error";
  }
}
