/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test, mock, beforeEach, afterEach } from "node:test";
import {
  getLogger,
  setDebuggableAppController,
} from "../../../../src/controller/utils/logging/logger.js";

const logConfig = {
  debug: {
    enabled: false,
    errors: true,
    info: true,
    verbose: true,
    warnings: true,
    setLogDefault() {
      // Stubbed.
    },
  },
};

suite("Logger", () => {
  let logMock: ReturnType<(typeof mock)["method"]>;
  let infoMock: ReturnType<(typeof mock)["method"]>;
  let warnMock: ReturnType<(typeof mock)["method"]>;
  let errorMock: ReturnType<(typeof mock)["method"]>;

  beforeEach(() => {
    logMock = mock.method(console, "log");
    infoMock = mock.method(console, "info");
    warnMock = mock.method(console, "warn");
    errorMock = mock.method(console, "error");

    setDebuggableAppController(logConfig);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test("does not log when disabled", async () => {
    const logger = getLogger();
    logConfig.debug.enabled = false;

    logger.log({ type: "info", args: ["Info"] });
    logger.log({ type: "warning", args: ["Warning"] });
    logger.log({ type: "error", args: ["Error"] });
    logger.log({ type: "verbose", args: ["Verbose"] });

    assert.strictEqual(logMock.mock.callCount(), 0);
    assert.strictEqual(infoMock.mock.callCount(), 0);
    assert.strictEqual(warnMock.mock.callCount(), 0);
    assert.strictEqual(errorMock.mock.callCount(), 0);
  });

  test("logs when disabled", async () => {
    const logger = getLogger();
    logConfig.debug.enabled = true;

    logger.log({ type: "info", args: ["Info"] });
    logger.log({ type: "warning", args: ["Warning"] });
    logger.log({ type: "error", args: ["Error"] });
    logger.log({ type: "verbose", args: ["Verbose"] });

    assert.strictEqual(logMock.mock.callCount(), 1);
    assert.strictEqual(infoMock.mock.callCount(), 1);
    assert.strictEqual(warnMock.mock.callCount(), 1);
    assert.strictEqual(errorMock.mock.callCount(), 1);
  });

  test("logs a set/get name", async () => {
    const logger = getLogger();
    logConfig.debug.enabled = true;

    logger.logItem("info", "get", "Item", "Info");

    assert.strictEqual(
      infoMock.mock.calls[0].arguments[0],
      "[\x1B[104;97m Item:get \x1B[m]"
    );
    assert.strictEqual(infoMock.mock.calls[0].arguments[1], "Info");
  });

  test("does not log for disabled categories", () => {
    const logger = getLogger();

    logConfig.debug.enabled = true;
    logConfig.debug.info = false;
    logConfig.debug.warnings = false;
    logConfig.debug.errors = false;
    logConfig.debug.verbose = false;

    logger.log({ type: "info", args: ["Info"] });
    logger.log({ type: "warning", args: ["Warning"] });
    logger.log({ type: "error", args: ["Error"] });
    logger.log({ type: "verbose", args: ["Verbose"] });

    assert.strictEqual(logMock.mock.callCount(), 0);
    assert.strictEqual(infoMock.mock.callCount(), 0);
    assert.strictEqual(warnMock.mock.callCount(), 0);
    assert.strictEqual(errorMock.mock.callCount(), 0);
  });

  test("warns if there is no controller", async () => {
    const logger = getLogger();

    setDebuggableAppController(null);

    logger.log({ type: "info", args: ["Info"] });

    assert.strictEqual(
      warnMock.mock.calls[0].arguments[0],
      "Logger called without app controller"
    );

    assert.strictEqual(logMock.mock.callCount(), 0);
    assert.strictEqual(infoMock.mock.callCount(), 1);
    assert.strictEqual(warnMock.mock.callCount(), 1);
    assert.strictEqual(errorMock.mock.callCount(), 0);
  });
});
