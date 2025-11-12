/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory";
import { err, ok } from "@breadboard-ai/utils";
import { shouldCallBackend } from "./data-transforms";

export { getBucketId };

async function getBucketId(
  moduleArgs: A2ModuleArgs
): Promise<Outcome<string | null>> {
  const callBackend = await shouldCallBackend(moduleArgs);
  if (callBackend) return null;
  const { fetchWithCreds, context } = moduleArgs;
  const gettingBucket = await new Memoize(async () => {
    const response = await fetchWithCreds(
      new URL(`/api/data/transform/bucket`, window.location.href),
      {
        signal: context.signal,
      }
    );
    return response.json();
  }).get();
  if (!ok(gettingBucket)) return gettingBucket;
  const bucketId = (gettingBucket as { bucketId: string }).bucketId;
  if (!bucketId) {
    return err(`Failed to get bucket name: invalid response from server`);
  }
  return bucketId;
}

class Memoize<T> {
  static #promise: Promise<unknown> | null = null;
  #initializer: () => Promise<T>;

  constructor(initializer: () => Promise<T>) {
    this.#initializer = initializer;
  }

  get(): Promise<T> {
    if (Memoize.#promise === null) {
      Memoize.#promise = this.#initializer();
    }
    return Memoize.#promise as Promise<T>;
  }
}
