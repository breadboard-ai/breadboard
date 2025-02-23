/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StoredDataCapabilityPart } from "@breadboard-ai/types";
import {
  BoardServer,
  DataPartTransformer,
  DataStore,
  DataStoreScope,
  RetrieveDataResult,
  Schema,
  SerializedDataStoreGroup,
  StoreDataResult,
} from "@google-labs/breadboard";
import { HarnessRunResult } from "@google-labs/breadboard/harness";

export { BoardServerAwareDataStore };

class BoardServerAwareDataStore implements DataStore {
  constructor(
    public readonly innerStore: DataStore,
    public readonly boardServers: BoardServer[]
  ) {}

  transformer(graphUrl: URL): DataPartTransformer | undefined {
    const server = this.#findServer(graphUrl);
    if (!server || !server.dataPartTransformer) return;

    return server.dataPartTransformer();
  }

  #findServer(url: URL): BoardServer | null {
    for (const server of this.boardServers) {
      if (server.canProvide(url)) {
        return server;
      }
    }
    return null;
  }

  // The rest is just proxying the inner store

  retrieveAsBlob(
    part: StoredDataCapabilityPart,
    graphUrl?: URL
  ): Promise<Blob> {
    return this.innerStore.retrieveAsBlob(part, graphUrl);
  }

  createGroup(groupId: string): void {
    return this.innerStore.createGroup(groupId);
  }

  drop(): Promise<void> {
    return this.innerStore.drop();
  }

  has(groupId: string): boolean {
    return this.innerStore.has(groupId);
  }

  releaseAll(): void {
    return this.innerStore.releaseAll();
  }

  releaseGroup(group: string): void {
    return this.innerStore.releaseGroup(group);
  }

  replaceDataParts(key: string, result: HarnessRunResult): Promise<void> {
    return this.innerStore.replaceDataParts(key, result);
  }

  serializeGroup(
    group: string,
    storeId?: string
  ): Promise<SerializedDataStoreGroup | null> {
    return this.innerStore.serializeGroup(group, storeId);
  }

  store(blob: Blob, storeId?: string): Promise<StoredDataCapabilityPart> {
    return this.innerStore.store(blob, storeId);
  }

  storeData(
    key: string,
    value: object | null,
    schema: Schema,
    scope: DataStoreScope
  ): Promise<StoreDataResult> {
    return this.innerStore.storeData(key, value, schema, scope);
  }

  retrieveData(key: string): Promise<RetrieveDataResult> {
    return this.innerStore.retrieveData(key);
  }
}
