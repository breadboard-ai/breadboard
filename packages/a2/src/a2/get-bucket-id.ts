/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Outcome } from "@breadboard-ai/types";
import { A2ModuleFactoryArgs } from "../runnable-module-factory";
import { err, ok } from "@breadboard-ai/utils";

export { getBucketId };

async function getBucketId({
  fetchWithCreds,
}: A2ModuleFactoryArgs): Promise<Outcome<string>> {
  const gettingBucket = await new Memoize(async () => {
    const response = await fetchWithCreds(
      new URL(`/api/data/transform/bucket`, window.location.href)
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
