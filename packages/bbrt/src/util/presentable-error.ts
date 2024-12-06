/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PresentableError {
  readonly message: string;
  readonly stack?: string;
  readonly additional?: PresentableError[];
}

export function coercePresentableError(error: unknown): PresentableError {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return {
      ...coercePresentableError(error.errors[0]),
      additional: error.errors.slice(1).map(coercePresentableError),
    };
  } else if (error instanceof Error) {
    let message = error.message ?? "";
    let stack = error.stack ?? "";
    const prefixedMessage = `Error: ${message}`;
    if (stack.startsWith(`${prefixedMessage}\n`)) {
      // Often times the stack trace contains a full copy of the message, with
      // an Error: prefix. Remove the redundancy.
      stack = stack.slice(prefixedMessage.length /* for the \n */ + 1);
      message = prefixedMessage;
    }
    return { message, stack };
  } else if (
    // An error-like object (anything with a truthy "message" property).
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    error.message
  ) {
    return {
      message: String(error.message),
      stack: "stack" in error ? String(error.stack) : undefined,
      additional:
        "additional" in error && Array.isArray(error.additional)
          ? error.additional.map(coercePresentableError)
          : undefined,
    };
  } else if (
    // A nested error (anything with a truthy "error" property).
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    error.error
  ) {
    return coercePresentableError(error.error);
  } else if (typeof error === "string") {
    return { message: error };
  } else {
    return { message: JSON.stringify(error, null, 2) };
  }
}
