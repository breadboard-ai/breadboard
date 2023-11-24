/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { Board } from "@google-labs/breadboard";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

export const nodeProxyServer = onRequest(
  { cors: true },
  (request, response) => {
    const board = new Board();

    logger.info("Hello logs!", { structuredData: true });
    response.send(board);
  }
);
