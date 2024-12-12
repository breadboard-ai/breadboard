/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { transposeResults } from "../util/transpose-results.js";
import type { Artifact, ArtifactBlob } from "./artifact-interface.js";
import type { ArtifactReaderWriter } from "./artifact-reader-writer.js";

const ARTIFACT_IDB_DB_NAME = "bbrt";
const ARTIFACT_IDB_DB_VERSION = 1;
const ARTIFACT_IDB_STORE_NAME = "artifacts";

export class IdbArtifactReaderWriter implements ArtifactReaderWriter {
  public async write(...artifacts: Artifact[]): Promise<Result<void>> {
    const open = await this.#openDB();
    if (!open.ok) {
      return open;
    }
    const db = open.value;
    const transaction = db.transaction(ARTIFACT_IDB_STORE_NAME, "readwrite");
    const store = transaction.objectStore(ARTIFACT_IDB_STORE_NAME);
    const promises = artifacts.map(
      (artifact) =>
        new Promise<Result<void>>((resolve) => {
          const request = store.put(artifact);
          request.onsuccess = () => resolve({ ok: true, value: undefined });
          request.onerror = () =>
            resolve({
              ok: false,
              error:
                `Failed to save artifact ${JSON.stringify(artifact.id)}:` +
                ` ${request.error?.message}`,
            });
        })
    );
    const transposed = transposeResults(await Promise.all(promises));
    if (!transposed.ok) {
      const abort = resultify(() => transaction.abort());
      if (!abort.ok) {
        console.error(
          `Internal Error: Failed to abort IndexedDB transaction`,
          abort.error
        );
      }
    }
    return resultify(() => transaction.commit());
  }

  async read(artifactId: string): Promise<Result<ArtifactBlob>> {
    const dbResult = await this.#openDB();
    if (!dbResult.ok) {
      return dbResult;
    }
    const db = dbResult.value;
    const requestResult = resultify(() => {
      const transaction = db.transaction(ARTIFACT_IDB_STORE_NAME, "readonly");
      const store = transaction.objectStore(ARTIFACT_IDB_STORE_NAME);
      return store.get(artifactId);
    });
    if (!requestResult.ok) {
      return requestResult;
    }
    const request = requestResult.value;

    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result) {
          resolve({ ok: true, value: request.result });
        } else {
          resolve({
            ok: false,
            error: `Artifact ${JSON.stringify(artifactId)} not found.`,
          });
        }
      };

      request.onerror = () =>
        resolve({
          ok: false,
          error:
            `Failed to get artifact ${JSON.stringify(artifactId)}:` +
            ` ${request.error?.message}`,
        });
    });
  }

  async #openDB(): Promise<Result<IDBDatabase>> {
    return new Promise((resolve) => {
      const request = indexedDB.open(
        ARTIFACT_IDB_DB_NAME,
        ARTIFACT_IDB_DB_VERSION
      );
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ARTIFACT_IDB_STORE_NAME)) {
          db.createObjectStore(ARTIFACT_IDB_STORE_NAME, {
            keyPath: "id" satisfies keyof Artifact,
          });
        }
      };
      request.onsuccess = () => resolve({ ok: true, value: request.result });
      request.onerror = () =>
        resolve({
          ok: false,
          error: `Failed to open database: ${request.error?.message}`,
        });
    });
  }
}
