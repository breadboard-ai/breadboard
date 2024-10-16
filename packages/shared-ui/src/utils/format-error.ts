/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorObject } from "@google-labs/breadboard";

export function formatError(error: string | ErrorObject): string {
  let output = "";
  if (typeof error === "string") {
    output = error;
  } else {
    if ((error.error as Error)?.name === "AbortError") {
      console.log("💖 actually aborted");
    }
    if (typeof error.error === "string") {
      output = error.error;
    } else {
      let messageOutput = "";
      let errorData = error;
      while (typeof errorData === "object") {
        if (errorData && "message" in errorData) {
          messageOutput += `${errorData.message}\n`;
        }

        errorData = errorData.error as ErrorObject;
      }

      output = messageOutput;
    }
  }
  return output.trim();
}
