/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ConsoleProgressManager } from "../../src/a2/agent/console-progress-manager.js";
import type { ConsoleEntry, WorkItem } from "@breadboard-ai/types";
import { RunController } from "../../src/sca/controller/subcontrollers/run/run-controller.js";

/**
 * Creates a minimal ConsoleEntry for testing.
 */
function createTestEntry(): ConsoleEntry {
  return RunController.createConsoleEntry("Test Step", "working");
}

describe("ConsoleProgressManager.usageMetadata", () => {
  let entry: ConsoleEntry;
  let manager: ConsoleProgressManager;

  beforeEach(() => {
    entry = createTestEntry();
    manager = new ConsoleProgressManager(entry, undefined);
  });

  it("initializes tokenUsage from null on first call", () => {
    assert.equal(entry.tokenUsage, null);

    manager.usageMetadata({
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      thoughtsTokenCount: 25,
      totalTokenCount: 175,
    });

    assert.deepEqual(entry.tokenUsage, {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      thoughtsTokenCount: 25,
      cachedContentTokenCount: 0,
      requestCount: 1,
    });
  });

  it("accumulates token counts across multiple calls", () => {
    manager.usageMetadata({
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      thoughtsTokenCount: 25,
    });

    manager.usageMetadata({
      promptTokenCount: 200,
      candidatesTokenCount: 100,
      thoughtsTokenCount: 50,
    });

    assert.deepEqual(entry.tokenUsage, {
      promptTokenCount: 300,
      candidatesTokenCount: 150,
      thoughtsTokenCount: 75,
      cachedContentTokenCount: 0,
      requestCount: 2,
    });
  });

  it("handles missing fields by defaulting to 0", () => {
    manager.usageMetadata({
      promptTokenCount: 100,
      // candidatesTokenCount and thoughtsTokenCount are undefined
    });

    assert.deepEqual(entry.tokenUsage, {
      promptTokenCount: 100,
      candidatesTokenCount: 0,
      thoughtsTokenCount: 0,
      cachedContentTokenCount: 0,
      requestCount: 1,
    });
  });

  it("creates a work item for each usageMetadata call", () => {
    manager.usageMetadata({
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      thoughtsTokenCount: 25,
      totalTokenCount: 175,
    });

    // Should have one work item for token usage
    assert.equal(entry.work.size, 1);

    const workItem = [...entry.work.values()][0] as WorkItem;
    assert.equal(workItem.title, "Token Usage");
  });

  it("does nothing when constructed without a consoleEntry", () => {
    const noEntryManager = new ConsoleProgressManager(undefined, undefined);

    // Should not throw
    noEntryManager.usageMetadata({
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      thoughtsTokenCount: 25,
    });
  });
});
