/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface ReadableStream<R> {
    [Symbol.asyncIterator](): AsyncIterableIterator<R>;
  }
}
