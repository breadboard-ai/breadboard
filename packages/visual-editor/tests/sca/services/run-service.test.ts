/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { RunService } from "../../../src/sca/services/run-service.js";
import type { RunConfig } from "@breadboard-ai/types";

/**
 * Creates a minimal mock RunConfig for testing.
 */
function makeMockRunConfig(): RunConfig {
  return {
    url: "test://board",
    runner: { edges: [], nodes: [] },
    diagnostics: true,
    kits: [],
  } as unknown as RunConfig;
}

suite("RunService", () => {
  test("createRunner returns runner and abortController", () => {
    const service = new RunService();
    const config = makeMockRunConfig();

    const result = service.createRunner(config);

    assert.ok(result.runner, "runner should be defined");
    assert.ok(result.abortController, "abortController should be defined");
    assert.ok(
      result.abortController instanceof AbortController,
      "abortController should be an AbortController"
    );
  });

  test("createRunner sets abort signal on config", () => {
    const service = new RunService();
    const config = makeMockRunConfig();

    const { abortController } = service.createRunner(config);

    // The signal should be connected - when we abort, it should be aborted
    assert.strictEqual(
      abortController.signal.aborted,
      false,
      "signal should not be aborted initially"
    );
    abortController.abort();
    assert.strictEqual(
      abortController.signal.aborted,
      true,
      "signal should be aborted after abort()"
    );
  });

  test("each createRunner call returns new instances", () => {
    const service = new RunService();
    const config = makeMockRunConfig();

    const result1 = service.createRunner(config);
    const result2 = service.createRunner(config);

    assert.notStrictEqual(
      result1.runner,
      result2.runner,
      "runners should be different instances"
    );
    assert.notStrictEqual(
      result1.abortController,
      result2.abortController,
      "abortControllers should be different instances"
    );
  });
});
