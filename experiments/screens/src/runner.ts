/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />

// import adventureGame from "../out/adventure-game";
import app from "../out/blog-post-writer";
import { Invoke } from "./types";
import { CapabilitiesImpl } from "./capabilities";
import "./ui/test-harness";

async function run(app: Invoke) {
  const appCapabilities = new CapabilitiesImpl();
  app(appCapabilities);
}

run(app as unknown as Invoke);
