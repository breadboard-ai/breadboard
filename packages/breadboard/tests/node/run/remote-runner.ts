/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";

import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import { fail } from "node:assert";
import { LocalRunner } from "../../../src/harness/local-runner.js";

const mockFetch = (runner: LocalRunner) => {
  const result: typeof globalThis.fetch = async (request, init) => {
    const url = request as string;
    const { method, body } = init || {};
    if (method !== "POST") {
      fail("Only POST requests are supported by mockFetch.");
    }
    if (url !== "https://example.com/run") {
      fail(`Only "https://example.com/run" is supported by mockFetch.`);
    }
    return new Response();
  };
  return result;
};

describe("RemoteRunner", async () => {
  test("can run simple graph", async () => {
    // Test code here
  });
});
