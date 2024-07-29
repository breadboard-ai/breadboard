/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataStore,
  isInlineData,
  isLLMContent,
  isStoredData,
  SerializedDataStoreGroup,
  SerializedStoredData,
  StoredDataCapabilityPart,
} from "@google-labs/breadboard";
import { HarnessRunResult } from "@google-labs/breadboard/harness";
import {
  asBase64,
  toStoredDataPart,
  retrieveAsBlob as genericRetrieveAsBlob,
} from "./common.js";

export type GroupID = string;
export type NodeTimeStamp = string;
export type OutputProperty = string;
export type OutputPropertyPartIndex = number;

export class DefaultDataStore implements DataStore {
  #lastGroupId: string | null = null;
  #dataStores = new Map<
    GroupID,
    Map<
      NodeTimeStamp,
      Map<
        OutputProperty,
        Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
      >
    >
  >();

  createGroup(groupId: string) {
    let dataStore = this.#dataStores.get(groupId);
    if (dataStore) {
      throw new Error(`Group with ID already exists: ${groupId}`);
    }

    dataStore = new Map<
      NodeTimeStamp,
      Map<
        OutputProperty,
        Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
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
        Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
      >();

      dataStore.set(nodeTimeStamp, properties);
    }

    properties.set(`direct-set-${nodeTimeStamp}`, new Map([[0, part]]));
    return part;
  }

  async retrieveAsBlob(part: StoredDataCapabilityPart): Promise<Blob> {
    return genericRetrieveAsBlob(part);
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
        Map<OutputPropertyPartIndex, StoredDataCapabilityPart>
      >();
      dataStore.set(nodeTimeStamp, properties);
    }

    for (const [property, value] of Object.entries(result.data.outputs)) {
      if (!isLLMContent(value)) {
        continue;
      }

      let partHandles = properties.get(property);
      if (!partHandles) {
        partHandles = new Map<
          OutputPropertyPartIndex,
          StoredDataCapabilityPart
        >();
        properties.set(property, partHandles);
      }

      for (let j = 0; j < value.parts.length; j++) {
        const part = value.parts[j];

        if (isInlineData(part)) {
          let storedDataPart = partHandles.get(j);
          if (!storedDataPart) {
            storedDataPart = await toStoredDataPart(part);
          }

          value.parts[j] = storedDataPart;
          partHandles.set(j, storedDataPart);
        } else if (isStoredData(part)) {
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
        const storedData = outputProperty.values();
        allHandles = [...storedData].map(async (storedDataPart) => {
          const { handle } = storedDataPart.storedData;
          const response = await fetch(handle);
          const blob = await response.blob();
          const mimeType = blob.type;
          const data = await asBase64(blob);
          return { handle, inlineData: { mimeType, data } };
        });
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
        for (const storedData of outputProperty.values()) {
          URL.revokeObjectURL(storedData.storedData.handle);
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
}
