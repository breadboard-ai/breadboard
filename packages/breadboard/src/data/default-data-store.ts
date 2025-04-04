/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent, StoredDataCapabilityPart } from "@breadboard-ai/types";
import { HarnessRunResult } from "../harness/types.js";
import { Schema } from "../types.js";
import {
  asBase64,
  toStoredDataPart,
  retrieveAsBlob as genericRetrieveAsBlob,
  isLLMContentArray,
  isMetadataEntry,
  isLLMContent,
  isInlineData,
  isStoredData,
} from "./common.js";
import type {
  DataStore,
  RetrieveDataResult,
  SerializedDataStoreGroup,
  SerializedStoredData,
  StoreDataResult,
} from "./types.js";

export type GroupID = string;
export type NodeTimeStamp = string;
export type OutputProperty = string;
export type OutputPropertyIndex = number;
export type OutputPropertyPartIndex = number;

type StoredDataEntry = {
  value: object | null;
  schema: Schema;
};

export class DefaultDataStore implements DataStore {
  #lastGroupId: string | null = null;
  #dataStores = new Map<
    GroupID,
    Map<
      NodeTimeStamp,
      Map<
        OutputProperty,
        Map<
          OutputPropertyIndex,
          Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
        >
      >
    >
  >();
  #keyValueStore = new Map<string, StoredDataEntry>();

  createGroup(groupId: string) {
    let dataStore = this.#dataStores.get(groupId);
    if (dataStore) {
      throw new Error(`Group with ID already exists: ${groupId}`);
    }

    dataStore = new Map<
      NodeTimeStamp,
      Map<
        OutputProperty,
        Map<
          OutputPropertyIndex,
          Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
        >
      >
    >();
    this.#dataStores.set(groupId, dataStore);
    this.#lastGroupId = groupId;
  }

  async store(blob: Blob, groupId?: string) {
    groupId ??= this.#lastGroupId ?? undefined;
    if (!groupId) {
      throw new Error("No active group - unable to store blob");
    }

    const dataStore = this.#dataStores.get(groupId);
    if (!dataStore) {
      throw new Error(`No group in data store with ID: ${groupId}`);
    }

    const part = await toStoredDataPart(blob);
    const nodeTimeStamp = Date.now().toFixed(3);
    let properties = dataStore.get(nodeTimeStamp);
    if (!properties) {
      properties = new Map<
        OutputProperty,
        Map<
          OutputPropertyIndex,
          Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
        >
      >();

      dataStore.set(nodeTimeStamp, properties);
    }

    properties.set(
      `direct-set-${nodeTimeStamp}`,
      new Map([[0, new Map([[0, part]])]])
    );
    return part;
  }

  async retrieveAsBlob(
    part: StoredDataCapabilityPart,
    graphUrl?: URL
  ): Promise<Blob> {
    return genericRetrieveAsBlob(part, graphUrl);
  }

  async replaceDataParts(
    groupId: string,
    result: HarnessRunResult
  ): Promise<void> {
    if (result.type !== "nodeend" || result.data.node.type !== "input") {
      return;
    }

    const dataStore = this.#dataStores.get(groupId);
    if (!dataStore) {
      throw new Error(
        `Unable to replace data parts, no group created for ${groupId}`
      );
    }

    const nodeTimeStamp = result.data.timestamp.toFixed(3);
    let properties = dataStore.get(nodeTimeStamp);
    if (!properties) {
      properties = new Map<
        OutputProperty,
        Map<
          OutputPropertyIndex,
          Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
        >
      >();
      dataStore.set(nodeTimeStamp, properties);
    }

    for (const [property, value] of Object.entries(result.data.outputs)) {
      if (!isLLMContent(value) && !isLLMContentArray(value)) {
        continue;
      }

      const values: LLMContent[] = isLLMContent(value) ? [value] : value;

      let propertyHandles = properties.get(property);
      if (!propertyHandles) {
        propertyHandles = new Map<
          OutputPropertyIndex,
          Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
        >();
        properties.set(property, propertyHandles);
      }

      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (isMetadataEntry(value)) {
          continue;
        }

        for (let j = 0; j < value.parts.length; j++) {
          const part = value.parts[j];

          if (isInlineData(part)) {
            let partHandles = propertyHandles.get(0);
            if (!partHandles) {
              partHandles = new Map<
                OutputPropertyIndex,
                StoredDataCapabilityPart
              >();
              propertyHandles.set(i, partHandles);
            }

            let storedDataPart = partHandles.get(j);
            if (!storedDataPart) {
              storedDataPart = await toStoredDataPart(part);
            }

            value.parts[j] = storedDataPart;
            partHandles.set(j, storedDataPart);
          } else if (isStoredData(part)) {
            let partHandles = propertyHandles.get(0);
            if (!partHandles) {
              partHandles = new Map<
                OutputPropertyIndex,
                StoredDataCapabilityPart
              >();
              propertyHandles.set(i, partHandles);
            }

            // This is a stored data from a previous run, so now we need to call
            // toStoredDataPart again to create a new stored data part for this
            // run.
            const storedDataPart = await toStoredDataPart(part);
            value.parts[j] = storedDataPart;
            partHandles.set(j, storedDataPart);
          }
        }
      }
    }
  }

  has(groupId: string) {
    return this.#dataStores.has(groupId);
  }

  async serializeGroup(
    groupId: string
  ): Promise<SerializedDataStoreGroup | null> {
    const nodes = this.#dataStores.get(groupId);
    if (!nodes) {
      return null;
    }

    let allHandles: Promise<SerializedStoredData>[] = [];
    for (const nodeTimeStamp of nodes.values()) {
      for (const outputProperty of nodeTimeStamp.values()) {
        for (const outputPropertyIndex of outputProperty.values()) {
          const storedData = outputPropertyIndex.values();
          allHandles = [...storedData].map(async (storedDataPart) => {
            const { handle } = storedDataPart.storedData;
            const response = await fetch(handle);
            const blob = await response.blob();
            const mimeType = blob.type;
            let data;
            if (mimeType.startsWith("text/")) {
              data = await blob.text();
            } else {
              data = await asBase64(blob);
            }
            return { handle, inlineData: { mimeType, data } };
          });
        }
      }
    }

    return Promise.all(allHandles);
  }

  releaseGroup(groupId: string): void {
    const nodes = this.#dataStores.get(groupId);
    if (!nodes) {
      return;
    }

    for (const nodeTimeStamp of nodes.values()) {
      for (const outputProperty of nodeTimeStamp.values()) {
        for (const outputPropertyIndex of outputProperty.values()) {
          for (const storedData of outputPropertyIndex.values()) {
            URL.revokeObjectURL(storedData.storedData.handle);
          }
        }
      }
    }

    this.#dataStores.delete(groupId);

    if (this.#lastGroupId === groupId) {
      this.#lastGroupId = null;
    }
  }

  releaseAll(): void {
    for (const groupId of this.#dataStores.keys()) {
      this.releaseGroup(groupId);
    }

    this.#lastGroupId = null;
  }

  async drop(): Promise<void> {
    this.releaseAll();
    this.#dataStores.clear();
    return;
  }

  async storeData(
    key: string,
    value: object | null,
    schema: Schema
  ): Promise<StoreDataResult> {
    // TODO: Implement scope handling.
    // Corresponds to the "session" scope.
    this.#keyValueStore.set(key, { value, schema });
    return { success: true };
  }

  async retrieveData(key: string): Promise<RetrieveDataResult> {
    const entry = this.#keyValueStore.get(key);
    if (!entry) {
      return { success: false, error: `No value found for key: ${key}` };
    }
    return { success: true, value: entry.value, schema: entry.schema };
  }
}
