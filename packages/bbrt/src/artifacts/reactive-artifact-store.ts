/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";
import { AsyncComputed } from "signal-utils/async-computed";
import type { Result } from "../util/result.js";
import { WeakCache } from "../util/weak-cache.js";
import type {
  ArtifactArrayBuffer,
  ArtifactBlob,
} from "./artifact-interface.js";
import type { ArtifactReaderWriter } from "./artifact-store-interface.js";

const modulePrivateReactiveArtifactSetMethod = Symbol("set");

export class ReactiveArtifactStore implements ArtifactReaderWriter {
  #underlying: ArtifactReaderWriter;
  #weakCache = new WeakCache<string, ReactiveArtifact>();

  constructor(underlying: ArtifactReaderWriter) {
    this.#underlying = underlying;
  }

  readReactive(artifactId: string): ReactiveArtifact {
    const cached = this.#weakCache.get(artifactId);
    if (cached !== undefined) {
      return cached;
    }
    const reactive = new ReactiveArtifact(this.#underlying, artifactId);
    this.#weakCache.set(artifactId, reactive);
    return reactive;
  }

  read(artifactId: string): Promise<Result<ArtifactBlob>> {
    // TODO(aomarks) We should share a cache between reactive and non-reactive.
    return this.#underlying.read(artifactId);
  }

  write(artifact: ArtifactBlob): Promise<Result<void>> {
    const result = this.#underlying.write(artifact);
    const liveReactive = this.#weakCache.get(artifact.id);
    if (liveReactive !== undefined) {
      liveReactive[modulePrivateReactiveArtifactSetMethod](artifact);
    }
    // TODO(aomarks) We may want to hold on to the Blob for a macrotask, since
    // write followed by read might be a common pattern, and we don't want to
    // throw away the value we already have.
    return result;
  }
}

// TODO(aomarks) Does this really need to be a class? I think maybe it can just
// be replaced directly with an AsyncComputed<ArtifactArrayBuffer>.
export class ReactiveArtifact {
  readonly #underlying: ArtifactReaderWriter;
  readonly #artifactId: string;

  constructor(underlying: ArtifactReaderWriter, artifactId: string) {
    this.#underlying = underlying;
    this.#artifactId = artifactId;
  }

  get arrayBuffer(): AsyncComputed<ArtifactArrayBuffer> {
    return this.#arrayBuffer;
  }

  readonly #override = new Signal.State<ArtifactBlob | undefined>(undefined);
  [modulePrivateReactiveArtifactSetMethod] = (artifact: ArtifactBlob) => {
    this.#override.set(artifact);
  };

  readonly #arrayBuffer = new AsyncComputed<ArtifactArrayBuffer>(
    async (): Promise<ArtifactArrayBuffer> => {
      let artifact = this.#override.get();
      if (artifact === undefined) {
        const result = await this.#underlying.read(this.#artifactId);
        if (!result.ok) {
          throw result.error;
        }
        artifact = result.value;
      }
      const buffer = await artifact.blob.arrayBuffer();
      return {
        id: this.#artifactId,
        kind: "buffer",
        mimeType: artifact.blob.type,
        buffer,
      };
    }
  );
}
