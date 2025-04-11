/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FirestoreStorageProvider } from "@breadboard-ai/board-server/firestore.js";

const firestore = new FirestoreStorageProvider();
const list = await firestore.listBoards("nobody");

console.log(list);
