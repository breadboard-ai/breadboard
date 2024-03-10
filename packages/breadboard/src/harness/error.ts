/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorObject } from "../types.js";

export const extractError = (e: unknown) => {
  const error = e as Error;
  let message;
  if (error?.cause) {
    const { cause } = error as { cause: ErrorObject };
    message = cause;
  } else {
    message = error.message;
  }
  return message;
};
