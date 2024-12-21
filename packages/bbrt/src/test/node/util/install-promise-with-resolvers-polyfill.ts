/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO(aomarks) Promise.withResolvers is available in all browsers, and Node
// 22. See if we can update the GitHub Actions runner version to 22, and if so
// we can delete this polyfill.
if (Promise.withResolvers === undefined) {
  Promise.withResolvers = <T>(): PromiseWithResolvers<T> => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
