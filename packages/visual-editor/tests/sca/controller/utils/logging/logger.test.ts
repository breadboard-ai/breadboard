/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, mock, beforeEach, afterEach } from "node:test";
import { getLogger } from "../../../../../src/sca/utils/logging/logger.js";

suite("Logger", () => {
  let debugMock: ReturnType<(typeof mock)["method"]>;
  let infoMock: ReturnType<(typeof mock)["method"]>;
  let warnMock: ReturnType<(typeof mock)["method"]>;
  let errorMock: ReturnType<(typeof mock)["method"]>;

  beforeEach(() => {
    debugMock = mock.method(console, "debug");
    infoMock = mock.method(console, "info");
    warnMock = mock.method(console, "warn");
    errorMock = mock.method(console, "error");
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("always logs (DevTools handles filtering)", async () => {
    const logger = getLogger();

    logger.log({ type: "info", args: ["Info"] });
    logger.log({ type: "warning", args: ["Warning"] });
    logger.log({ type: "error", args: ["Error"] });
    logger.log({ type: "verbose", args: ["Verbose"] });

    assert.strictEqual(debugMock.mock.callCount(), 1);
    assert.strictEqual(infoMock.mock.callCount(), 1);
    assert.strictEqual(warnMock.mock.callCount(), 1);
    assert.strictEqual(errorMock.mock.callCount(), 1);
  });

  test("logs a set/get name", async () => {
    const logger = getLogger();

    logger.logItem("info", "get", "Item", "Info");

    assert.strictEqual(
      infoMock.mock.calls[0].arguments[0],
      "[\x1B[104;97m Item:get \x1B[m]"
    );
    assert.strictEqual(infoMock.mock.calls[0].arguments[1], "Info");
  });
});
