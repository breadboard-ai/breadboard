/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, test } from "vitest";

import { promisifyEvent, promisifyEventOnce } from "../src/events";

test("promisifyEvent works with single event promise", async () => {
  const target = new EventTarget();
  const promise = promisifyEvent(target, "foo");
  target.dispatchEvent(new Event("foo"));
  const event = await promise();
  expect(event).toBeInstanceOf(Event);
  expect(event).toContain({ type: "foo" });
});

test("promisifyEvent works with multiple event promises", async () => {
  const target = new EventTarget();
  const promisifiedEvent = promisifyEvent(target, "foo");
  {
    target.dispatchEvent(new Event("foo"));
    const event = await promisifiedEvent();
    expect(event).toBeInstanceOf(Event);
    expect(event).toContain({ type: "foo" });
  }
  {
    target.dispatchEvent(new Event("foo"));
    const event = await promisifiedEvent();
    expect(event).toBeInstanceOf(Event);
    expect(event).toContain({ type: "foo" });
  }
  {
    target.dispatchEvent(new Event("foo"));
    target.dispatchEvent(new Event("foo"));
    const event1 = await promisifiedEvent();
    expect(event1).toBeInstanceOf(Event);
    expect(event1).toContain({ type: "foo" });
    const event2 = await promisifiedEvent();
    expect(event2).toBeInstanceOf(Event);
    expect(event2).toContain({ type: "foo" });
  }
  {
    const promises = [promisifiedEvent(), promisifiedEvent()];
    target.dispatchEvent(new Event("foo"));
    target.dispatchEvent(new Event("foo"));
    const events = await Promise.all(promises);
    events.forEach((event) => {
      expect(event).toBeInstanceOf(Event);
      expect(event).toContain({ type: "foo" });
    });
  }
});

test("promisifyEventOnce works", async () => {
  const target = new EventTarget();
  const promise = promisifyEventOnce(target, "foo");
  target.dispatchEvent(new Event("foo"));
  const event = await promise;
  expect(event).toBeInstanceOf(Event);
  expect(event).toContain({ type: "foo" });
});
