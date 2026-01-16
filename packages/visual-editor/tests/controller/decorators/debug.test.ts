/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { before, mock, suite, test } from "node:test";
import { debug } from "../../../src/controller/decorators/debug.js";
import { RootController } from "../../../src/controller/subcontrollers/root-controller.js";
import { setDebuggableAppController } from "../../../src/controller/utils/logging/logger.js";

suite("Debug Decorator", () => {
  before(() => {
    setDebuggableAppController({
      debug: {
        enabled: true,
        errors: true,
        info: true,
        verbose: true,
        warnings: true,
        setLogDefault() {
          // Stubbed.
        },
      },
    });
  });

  test("should work", async () => {
    class DebugTestController extends RootController {
      @debug() get name() {
        return "test";
      }
    }

    const instance = new DebugTestController();
    assert.strictEqual(instance.name, "test");
  });

  test("should log getter and setters (boolean)", async () => {
    class DebugTestController extends RootController {
      private _name = "test";

      @debug({ log: true })
      get name() {
        return this._name;
      }
      @debug({ log: true })
      set name(_name) {
        this._name = _name;
      }
    }

    // Mock the console.info calls.
    const infoMock = mock.method(console, "info");

    const instance = new DebugTestController();
    const name = instance.name;
    assert.strictEqual(name, "test");
    await instance.isSettled;

    instance.name = "foo";
    await instance.isSettled;
    const name2 = instance.name;
    assert.strictEqual(name2, "foo");

    // Retrieving the name should have fired the getter & setter logs.
    const callInfo = infoMock.mock.calls;
    infoMock.mock.restore();

    assert.deepStrictEqual(callInfo[0].arguments, [
      "[\x1B[104;97m name:get \x1B[m]",
      "test",
    ]);
    assert.deepStrictEqual(callInfo[1].arguments, [
      "[\x1B[104;97m name:set \x1B[m]",
      "foo",
    ]);
    assert.deepStrictEqual(callInfo[2].arguments, [
      "[\x1B[104;97m name:get \x1B[m]",
      "foo",
    ]);
  });

  test("should log getter and setters (object)", async () => {
    class DebugTestController extends RootController {
      private _name = "test";

      @debug({
        log: {
          label: "Custom Get Name",
          format(v, host) {
            return host.info(v);
          },
        },
      })
      get name() {
        return this._name;
      }
      @debug({
        log: {
          label: "Custom Set Name",
          format(v, host) {
            return host.info(v);
          },
        },
      })
      set name(_name) {
        this._name = _name;
      }
    }

    // Mock the console.info calls.
    const infoMock = mock.method(console, "info");

    const instance = new DebugTestController();
    const name = instance.name;
    assert.strictEqual(name, "test");
    await instance.isSettled;

    instance.name = "foo";
    await instance.isSettled;
    const name2 = instance.name;
    assert.strictEqual(name2, "foo");

    // Retrieving the name should have fired the getter & setter logs.
    const callInfo = infoMock.mock.calls;
    infoMock.mock.restore();

    assert.deepStrictEqual(callInfo[0].arguments, [
      "[\x1B[104;97m Custom Get Name:get \x1B[m]",
      "test",
    ]);
    assert.deepStrictEqual(callInfo[1].arguments, [
      "[\x1B[104;97m Custom Set Name:set \x1B[m]",
      "foo",
    ]);
    assert.deepStrictEqual(callInfo[2].arguments, [
      "[\x1B[104;97m Custom Get Name:get \x1B[m]",
      "foo",
    ]);
  });
});
