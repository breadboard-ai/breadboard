/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type DataStore } from "@google-labs/breadboard";
import { createContext } from "@lit/context";

export type DataStoreContext = {
  instance: DataStore | null;
};

export const dataStoreContext = createContext<DataStoreContext>("datastore");
