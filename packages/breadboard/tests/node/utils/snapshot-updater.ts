/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { SnapshotUpdater } from "../../../src/utils/snapshot-updater.js";
import { deepStrictEqual } from "node:assert";

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
});
