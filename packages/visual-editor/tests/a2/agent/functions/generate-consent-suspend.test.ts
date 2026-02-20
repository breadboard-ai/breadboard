/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { ConsentType } from "@breadboard-ai/types";
import {
  createMockGenerators,
  createMockFileSystem,
  createMockTranslator,
  createMockTaskTreeManager,
  createMockSink,
  getHandler,
} from "../../../agent/functions/generate-test-utils.js";
import { getGenerateFunctionGroup } from "../../../../src/a2/agent/functions/generate.js";
import { stubModuleArgs } from "../../../useful-stubs.js";
import type { AgentEvent } from "../../../../src/a2/agent/agent-event.js";

suite("generate_text queryConsent suspend", () => {
  test("emits queryConsent suspend event when url_context is enabled and consent is granted", async () => {
    // Create a mock sink that approves consent
    const sink = createMockSink({
      queryConsent: true,
    });

    const group = getGenerateFunctionGroup({
      fileSystem: createMockFileSystem(),
      moduleArgs: stubModuleArgs,
      translator: createMockTranslator(),
      taskTreeManager: createMockTaskTreeManager(),
      generators: createMockGenerators(),
      sink,
    });

    const handler = getHandler(group, "generate_text");

    // Call with url_context enabled
    await handler(
      {
        prompt: "Search the web for breadboard info",
        url_context: true,
      },
      () => {}
    );

    // Find the queryConsent event in the captured events
    const consentEvents = sink.emitted.filter(
      (e: AgentEvent) => e.type === "queryConsent"
    );
    assert.strictEqual(
      consentEvents.length,
      1,
      `Expected 1 queryConsent event, got ${consentEvents.length}`
    );

    const event = consentEvents[0];
    assert.strictEqual(event.type, "queryConsent");
    if (event.type === "queryConsent") {
      assert.ok(event.requestId, "Should have a requestId");
      assert.strictEqual(
        event.consentType,
        ConsentType.GET_ANY_WEBPAGE,
        "Should request GET_ANY_WEBPAGE consent"
      );
      assert.ok("scope" in event, "Should include scope");
      assert.ok("graphUrl" in event, "Should include graphUrl");
    }
  });

  test("returns error when url_context consent is denied", async () => {
    // Create a mock sink that denies consent
    const sink = createMockSink({
      queryConsent: false,
    });

    const group = getGenerateFunctionGroup({
      fileSystem: createMockFileSystem(),
      moduleArgs: stubModuleArgs,
      translator: createMockTranslator(),
      taskTreeManager: createMockTaskTreeManager(),
      generators: createMockGenerators(),
      sink,
    });

    const handler = getHandler(group, "generate_text");

    const result = await handler(
      {
        prompt: "Search the web for breadboard info",
        url_context: true,
      },
      () => {}
    );

    // Should return an error when consent is denied
    assert.ok(result, "Should return a result");
    assert.ok(
      "error" in result || "$error" in result,
      "Should return an error when consent is denied"
    );
  });

  test("does not emit queryConsent when url_context is not set", async () => {
    const sink = createMockSink();

    const group = getGenerateFunctionGroup({
      fileSystem: createMockFileSystem(),
      moduleArgs: stubModuleArgs,
      translator: createMockTranslator(),
      taskTreeManager: createMockTaskTreeManager(),
      generators: createMockGenerators(),
      sink,
    });

    const handler = getHandler(group, "generate_text");

    await handler(
      {
        prompt: "Generate some text",
      },
      () => {}
    );

    // Should NOT have any queryConsent events
    const consentEvents = sink.emitted.filter(
      (e: AgentEvent) => e.type === "queryConsent"
    );
    assert.strictEqual(
      consentEvents.length,
      0,
      "Should not emit queryConsent when url_context is not set"
    );
  });
});
