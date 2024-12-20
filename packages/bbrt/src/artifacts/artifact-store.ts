/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { Signal } from "signal-polyfill";
import { AsyncComputed } from "signal-utils/async-computed";
import type { EmptyObject } from "../util/empty-object.js";
import { Lock } from "../util/lock.js";
import type { Result } from "../util/result.js";
import { WeakCache } from "../util/weak-cache.js";
import type { ArtifactBlob } from "./artifact-interface.js";
import type { ArtifactReaderWriter } from "./artifact-reader-writer.js";

// TODO(aomarks) It's kind of weird that we have to included `undefined` here,
// but there doesn't seem to be a way to use the @consume decorator without it.
export const artifactStoreContext = createContext<ArtifactStore | undefined>(
  "ArtifactStore"
);

export class ArtifactStore {
  readonly #underlying: ArtifactReaderWriter;
  readonly #weakCache = new WeakCache<string, ArtifactEntry>();

  constructor(underlying: ArtifactReaderWriter) {
    this.#underlying = underlying;
  }

  entry(artifactId: string): ArtifactEntry {
    const cached = this.#weakCache.get(artifactId);
    if (cached !== undefined) {
      return cached;
    }
    const entry = new ArtifactEntry(artifactId, this.#underlying);
    this.#weakCache.set(artifactId, entry);
    return entry;
  }
}

export class ArtifactEntry {
  readonly #artifactId: string;
  readonly #underlying: ArtifactReaderWriter;

  constructor(artifactId: string, underlying: ArtifactReaderWriter) {
    this.#artifactId = artifactId;
    this.#underlying = underlying;
  }

  #readPromise: Promise<Result<ArtifactBlob>> | null = null;
  #read() {
    return (this.#readPromise ??= this.#underlying.read(this.#artifactId));
  }

  async #write(blob: Blob): Promise<Result<void>> {
    const artifact: ArtifactBlob = { id: this.#artifactId, kind: "blob", blob };
    const result = await this.#underlying.write(artifact);
    if (!result.ok) {
      return result;
    }
    // Note that no other local readers of this Artifact will see the new Blob
    // until the underlying storage write succeeded. We do this to prefer
    // consistency over responsiveness, but for slower underlying storage it
    // might be better to update immediately, and error asyncronously on failure
    // (and then you'd also want to roll back any subsequent changes... gets a
    // bit complicated).
    this.#readPromise = Promise.resolve({ ok: true, value: artifact });
    this.#notifySignal.set({});
    return { ok: true, value: undefined };
  }

  readonly #exclusiveReadWriteLock = new Lock();
  async acquireExclusiveReadWriteLock() {
    const unlock = await this.#exclusiveReadWriteLock.acquire();
    return {
      read: async () => this.#read(),
      write: async (blob: Blob) => this.#write(blob),
      [Symbol.dispose]: unlock,
    };
  }

  readonly #notifySignal = new Signal.State<EmptyObject>({});

  readonly blob = new AsyncComputed(async () => {
    this.#notifySignal.get(); // Stay tracked.
    const result = await this.#read();
    if (!result.ok) {
      // TODO(aomarks) Is throwing really the best way to set the error state on
      // a Signal.Computed? A Result-aware Computed could be nice?
      throw result.error;
    }
    return result.value.blob;
  });

  readonly text = new AsyncComputed<string>(async () => {
    return (await this.blob.complete).text();
  });

  readonly json = new AsyncComputed<object>(async () => {
    return JSON.parse(await this.text.complete);
  });

  readonly url = new AsyncComputed<string>(async () => {
    return URL.createObjectURL(await this.blob.complete);
  });
}
