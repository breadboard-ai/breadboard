/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

// import { screens } from "./apps/adventure-game";
import adventureGame from "../out/adventure-game";
import { Invoke } from "./types";
import { CapabilitiesImpl } from "./capabilities";
import "./ui/test-harness";

async function run(app: Invoke) {
  const appCapabilities = new CapabilitiesImpl();
  app(appCapabilities);
}

run(adventureGame as unknown as Invoke);
