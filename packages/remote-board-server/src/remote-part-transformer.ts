/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataPartTransformer, err, Outcome } from "@google-labs/breadboard";
import {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { RemoteConnector } from "./types";

export { RemotePartTransformer };

class RemotePartTransformer implements DataPartTransformer {
  constructor(public readonly connector: RemoteConnector) {}

  async persistPart(
    part: InlineDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    try {
      const response = await fetch(
        await this.connector.createRequest("blobs", "POST", part)
      );
      if (!response.ok) {
        return err(await response.text());
      }
      return (await response.json()) as StoredDataCapabilityPart;
    } catch (e) {
      return err(`Failed to store blob: ${(e as Error).message}`);
    }
  }

  addEphemeralBlob(_blob: Blob): StoredDataCapabilityPart {
    throw new Error("Not implemented");
  }

  async persistentToEphemeral(
    _part: StoredDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>> {
    return err("Not implemented");
  }
}
