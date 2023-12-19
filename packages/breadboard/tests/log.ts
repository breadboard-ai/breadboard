/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

class OutputCapture {
  buffer: string[] = [];
  #captured?: typeof process.stdout.write;

  capture() {
    this.#captured = process.stdout.write;
    process.stdout.write = (message: string) => {
      this.buffer.push(message);
      return true;
    };
  }

  release() {
    if (this.#captured) {
      process.stdout.write = this.#captured;
      this.#captured = undefined;
    }
  }
}

type CustomEventInit = EventInit & { detail: unknown };

class CustomEvent extends Event {
  detail: unknown;

  constructor(message: string, data: CustomEventInit) {
    super(message, data);
    this.detail = data.detail;
  }
}

const et = new EventTarget();
et.dispatchEvent(new CustomEvent("message", { detail: "foo" }));

import { LogProbe } from "../src/log.js";

test("LogProbe listens to events", (t) => {
  const logs: unknown[] = [];
  const probe = new LogProbe({
    log: (...args) => {
      logs.push(args as string[]);
    },
  });
  probe.dispatchEvent(new CustomEvent("input", { detail: "test" }));
  probe.dispatchEvent(new CustomEvent("skip", { detail: "test" }));
  probe.dispatchEvent(new CustomEvent("node", { detail: "test" }));
  probe.dispatchEvent(new CustomEvent("output", { detail: "test" }));
  t.deepEqual(logs, [
    ["input", "test"],
    ["skip", "test"],
    ["node", "test"],
    ["output", "test"],
  ]);
});

test("LogProbe can be used without a receiver", (t) => {
  const probe = new LogProbe();
  const capture = new OutputCapture();
  capture.capture();
  probe.dispatchEvent(new CustomEvent("input", { detail: "test" }));
  probe.dispatchEvent(new CustomEvent("skip", { detail: "test" }));
  probe.dispatchEvent(new CustomEvent("node", { detail: "test" }));
  probe.dispatchEvent(new CustomEvent("output", { detail: "test" }));
  capture.release();
  t.deepEqual(capture.buffer, [
    "input test\n",
    "skip test\n",
    "node test\n",
    "output test\n",
  ]);
});
