/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kit } from "@google-labs/breadboard";

export const iframeProxyConfig = async (): Promise<Kit> => {
  return {
    url: "iframe-kit",
    handlers: {
      runPython: {
        invoke: async (input) => {
          console.log("input", input);
          return { context: "iframe-python-output" };
        },
      },
    },
  };
};
