/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const formatRunError = (e: unknown) => {
  if (typeof e === "string") {
    return e;
  }
  if (maybeError(e)) {
    return e.message;
  }
  // Presume it's an ErrorObject.
  const error = (e as { error: unknown }).error;
  if (typeof error === "string") {
    return error;
  }
  if (maybeError(error)) {
    return error.message;
  }
  return JSON.stringify(error);

  function maybeError(e: unknown): e is Error {
    return "message" in (e as Error);
  }
};
