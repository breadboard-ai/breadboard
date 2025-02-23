/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { err, type Outcome } from "@google-labs/breadboard";
import {
  SecretsProvider,
  type SecretsGetKeyResult,
} from "../../proxy/secrets.js";
import type { FileAPIMetadata } from "../../blob-store.js";

export { GeminiFileApi };

const GEMINI_API_KEY = "GEMINI_KEY";

class GeminiFileApi {
  #apiKey: Promise<SecretsGetKeyResult>;

  constructor() {
    this.#apiKey = SecretsProvider.instance().getKey(GEMINI_API_KEY);
  }

  async upload(_body: ReadableStream): Promise<Outcome<FileAPIMetadata>> {
    return err(`Not implemented yet`);
  }
}
