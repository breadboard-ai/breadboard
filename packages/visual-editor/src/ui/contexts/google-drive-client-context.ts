/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";
import { type GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";

export const googleDriveClientContext = createContext<
  GoogleDriveClient | undefined
>("GoogleDriveClient");
