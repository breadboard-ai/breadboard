/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  asBase64,
  DataStore,
  InlineDataCapabilityPart,
  isStoredData,
  SerializedDataStoreGroup,
  StoredDataCapabilityPart,
} from "@google-labs/breadboard";

export class DefaultDataStore implements DataStore {
  static supported(): boolean {
    return true;
  }

  #groupCount = 1;
  #items = new Map<number, string[]>();

  async store(data: Blob): Promise<StoredDataCapabilityPart> {
    const handle = URL.createObjectURL(data);
    let groupHandles = this.#items.get(this.#groupCount);
    if (!groupHandles) {
      groupHandles = [];
      this.#items.set(this.#groupCount, groupHandles);
    }
    groupHandles.push(handle);
    const mimeType = data.type;
    return {
      storedData: { handle, mimeType },
    };
  }

  async retrieve(
    storedData: StoredDataCapabilityPart
  ): Promise<InlineDataCapabilityPart> {
    const raw = await this.retrieveAsBlob(storedData);
    const mimeType = storedData.storedData.mimeType;
    const data = await asBase64(raw);
    return { inlineData: { mimeType, data } };
  }

  async retrieveAsBlob(storedData: StoredDataCapabilityPart): Promise<Blob> {
    if (!isStoredData(storedData)) {
      throw new Error("Invalid stored data");
    }

    const { handle } = storedData.storedData;
    const response = await fetch(handle);
    return await response.blob();
  }

  async retrieveAsURL(storedData: StoredDataCapabilityPart): Promise<string> {
    if (!isStoredData(storedData)) {
      throw new Error("Invalid stored data");
    }

    const { handle } = storedData.storedData;
    return handle;
  }

  startGroup(): void {
    // TODO: Support nested groups.
    this.#groupCount;
  }

  endGroup(): number {
    return this.#groupCount++;
  }

  async serializeGroup(
    group: number
  ): Promise<SerializedDataStoreGroup | null> {
    const handles = this.#items.get(group);
    if (!handles) {
      return null;
    }

    return Promise.all(
      handles.map(async (handle) => {
        return fetch(handle).then(async (response) => {
          const blob = await response.blob();
          const mimeType = blob.type;
          const data = await asBase64(blob);
          return { handle, inlineData: { mimeType, data } };
        });
      })
    );
  }

  releaseGroup(group: number): void {
    const handles = this.#items.get(group);
    if (!handles) {
      return;
    }

    for (const handle of handles) {
      URL.revokeObjectURL(handle);
    }
  }

  releaseAll(): void {
    for (const group of this.#items.keys()) {
      this.releaseGroup(group);
    }
  }

  async copyToNewestGroup(storedData: StoredDataCapabilityPart) {
    const blob = await this.retrieveAsBlob(storedData);
    const newHandle = await this.store(blob);

    return newHandle;
  }

  async drop() {
    this.releaseAll();
    this.#items.clear();
  }
}
