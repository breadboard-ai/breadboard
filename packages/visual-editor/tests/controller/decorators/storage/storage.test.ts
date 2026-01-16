/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { WebStorageWrapper } from "../../../../src/controller/decorators/storage/local.js";
import { IdbStorageWrapper } from "../../../../src/controller/decorators/storage/idb.js";
import { Storage } from "../../../../src/controller/types.js";

suite("Field Storage", () => {
  async function testStorage(storage: Storage) {
    const KEY = "Field Storage Foo";
    const VALUE = "foo";

    // Set.
    await storage.set(KEY, VALUE);
    const val = await storage.get(KEY);
    assert(val, KEY);

    // Delete.
    await storage.delete(KEY);

    // Check.
    const val2 = await storage.get(KEY);
    assert.notStrictEqual(val2, VALUE);

    // Set again.
    await storage.set(KEY, VALUE);
    const val3 = await storage.get(KEY);
    assert(val3, KEY);
  }

  suite("Local", () => {
    test("read & write", async () => {
      testStorage(new WebStorageWrapper("local"));
    });

    test("raw read", async () => {
      const local = new WebStorageWrapper("local");
      localStorage.setItem("val", "`item`");
      const v = await local.get("val");
      assert.equal(v, "`item`");
    });
  });

  suite("Session", () => {
    test("read & write", async () => {
      testStorage(new WebStorageWrapper("session"));
    });

    test("raw read", async () => {
      const session = new WebStorageWrapper("session");
      sessionStorage.setItem("val", "`item`");
      const v = await session.get("val");
      assert.equal(v, "`item`");
    });
  });

  suite("IDB", () => {
    test("read & write", async () => {
      testStorage(new IdbStorageWrapper("test-store", "test-db"));
    });
  });
});
