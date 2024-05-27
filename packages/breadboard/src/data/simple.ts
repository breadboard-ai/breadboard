/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asBase64, isStoredData } from "./common.js";
import {
  DataStore,
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "./types.js";

export class SimpleDataStore implements DataStore {
  async store(data: Blob): Promise<StoredDataCapabilityPart> {
    // TODO: Figure out how to revoke the URLs when the data
    // is no longer needed.
    const handle = URL.createObjectURL(data);
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
}
