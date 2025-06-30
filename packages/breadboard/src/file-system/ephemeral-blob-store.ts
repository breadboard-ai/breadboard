/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  EphemeralBlobHandle,
  EphemeralBlobStore,
  PersistentBlobHandle,
} from "@breadboard-ai/types";

export { createEphemeralBlobStore };

class EphemeralBlobsImpl implements EphemeralBlobStore {
  #byBlobHandle: Map<PersistentBlobHandle, EphemeralBlobHandle> = new Map();
  #byEphemeralHandle: Map<EphemeralBlobHandle, PersistentBlobHandle> =
    new Map();

  byEphemeralHandle(
    handle: EphemeralBlobHandle
  ): PersistentBlobHandle | undefined {
    return this.#byEphemeralHandle.get(handle);
  }
  byPersistentHandle(handle: PersistentBlobHandle): string | undefined {
    return this.#byBlobHandle.get(handle);
  }
  add(
    blob: Blob,
    persistent?: PersistentBlobHandle
  ): { ephemeral: EphemeralBlobHandle; persistent: PersistentBlobHandle } {
    const ephemeral = URL.createObjectURL(blob);
    persistent ??= `files:${crypto.randomUUID()}`;
    this.#byBlobHandle.set(persistent, ephemeral);
    this.#byEphemeralHandle.set(ephemeral, persistent);
    return { ephemeral, persistent };
  }
  get size() {
    return this.#byBlobHandle.size;
  }
}

function createEphemeralBlobStore(): EphemeralBlobStore {
  return new EphemeralBlobsImpl();
}
