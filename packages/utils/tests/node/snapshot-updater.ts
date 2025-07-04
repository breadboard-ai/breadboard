/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { SnapshotUpdater } from "../../src/snapshot-updater.js";
import { deepStrictEqual, rejects } from "node:assert";

describe("SnapshotUpdater", async () => {
  await it("correctly initializes and resolves to latest", async () => {
    const updates: [previous: string, current: string][] = [];

    const updater = new SnapshotUpdater({
      initial: () => "foo",
      latest: async () => "bar",
      willUpdate(previous, current) {
        updates.push([previous, current]);
      },
    });
    deepStrictEqual(updater.current(), "foo");
    deepStrictEqual(await updater.latest(), "bar");
    deepStrictEqual(updater.current(), "bar");
    deepStrictEqual(updates, [["foo", "bar"]]);
  });

  await it("querying inital value triggers refresh", async () => {
    const updates: [previous: string, current: string][] = [];

    const updater = new SnapshotUpdater({
      initial: () => "foo",
      latest: async () => "bar",
      willUpdate(previous, current) {
        updates.push([previous, current]);
      },
    });
    deepStrictEqual(updater.current(), "foo");
    await Promise.resolve();
    deepStrictEqual(updater.current(), "bar");
    deepStrictEqual(updates, [["foo", "bar"]]);
  });

  await it("coalesces multiple requests to get latest", async () => {
    const updates: [previous: string, current: string][] = [];

    const updater = new SnapshotUpdater({
      initial: () => "foo",
      latest: async () => "bar",
      willUpdate(previous, current) {
        updates.push([previous, current]);
      },
    });
    deepStrictEqual(updater.current(), "foo");
    updater.latest();
    updater.latest();
    await updater.latest();
    deepStrictEqual(updater.current(), "bar");
    deepStrictEqual(updates, [["foo", "bar"]]);
  });

  await it("correctly causes refresh when asked", async () => {
    const updates: [previous: string, current: string][] = [];

    const updater = new SnapshotUpdater({
      initial: () => "foo",
      latest: async () => "bar",
      willUpdate(previous, current) {
        updates.push([previous, current]);
      },
    });
    deepStrictEqual(updater.current(), "foo");
    await updater.latest();
    deepStrictEqual(updater.current(), "bar");
    deepStrictEqual(updates, [["foo", "bar"]]);
    await Promise.resolve();
    updater.refresh();
    await Promise.resolve();
    deepStrictEqual(updater.current(), "bar");
    deepStrictEqual(updates, [
      ["foo", "bar"],
      ["bar", "bar"],
    ]);
  });

  await it("caches latest unless asked to refresh", async () => {
    const updates: [previous: string, current: string][] = [];
    let counter = 0;

    const updater = new SnapshotUpdater({
      initial: () => "foo",
      latest: async () => `latest-${counter++}`,
      willUpdate(previous, current) {
        updates.push([previous, current]);
      },
    });
    deepStrictEqual(updater.current(), "foo");
    await updater.latest();
    deepStrictEqual(updater.current(), "latest-0");
    deepStrictEqual(updates, [["foo", "latest-0"]]);
    await Promise.resolve();
    updater.refresh();
    await Promise.resolve();
    deepStrictEqual(updater.current(), "latest-1");
    deepStrictEqual(updates, [
      ["foo", "latest-0"],
      ["latest-0", "latest-1"],
    ]);
    const value = await updater.snapshot().latest;
    deepStrictEqual(value, "latest-1");
    updater.refresh();
    await Promise.resolve();
    deepStrictEqual(updater.current(), "latest-2");
    deepStrictEqual(updates, [
      ["foo", "latest-0"],
      ["latest-0", "latest-1"],
      ["latest-1", "latest-2"],
    ]);
  });

  await it("handles errors thrown when obtaining latest", async () => {
    let counter = 0;
    const updates: [previous: string, current: string][] = [];

    const updater = new SnapshotUpdater({
      initial: () => "foo",
      latest: async () => {
        counter++;
        throw new Error("nope");
      },
      willUpdate(previous, current) {
        updates.push([previous, current]);
      },
    });

    deepStrictEqual(updater.current(), "foo");
    rejects(async () => {
      await updater.latest();
    });
    deepStrictEqual(counter, 1);
    deepStrictEqual(updater.current(), "foo");
    rejects(updater.latest());
    deepStrictEqual(counter, 1);
    updater.refresh();
    rejects(updater.latest());
    deepStrictEqual(counter, 2);
    deepStrictEqual(updates, []);
  });
});
