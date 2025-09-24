/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { describe, it } from "node:test";

import { DataModel } from "../../0.7/data/model.js";

const wait = <T>(t: number, v: T) =>
  new Promise<T>((r) => setTimeout(() => r(v), t));

describe("DataModel", () => {
  it("throws for empty data sets", () => {
    assert.throws(() => {
      new DataModel([]);
    });
  });

  describe("which is not finalized", () => {
    it("handles data (not prefixed)", async () => {
      const model = new DataModel([{ version: "0.7" }, { root: "root" }]);

      // Since the model is not finalized this call will create a Promise which
      // should be resolved when the value arrives.
      const checker = model.getDataProperty("/data/value");

      await model.setDataProperty("/data/value", "", "tree");
      const newValue = await checker;
      assert.equal(newValue, "tree");
    });

    it("handles data (prefixed)", async () => {
      const model = new DataModel([{ version: "0.7" }, { root: "root" }]);

      // Since the model is not finalized this call will create a Promise which
      // should be resolved when the value arrives.
      const checker = model.getDataProperty("/data/value");

      await model.setDataProperty("value", "data", "tree");
      const newValue = await checker;
      assert.equal(newValue, "tree");
    });

    it("times out on data (prefixed)", async () => {
      const model = new DataModel([{ version: "0.7" }, { root: "root" }]);

      // Since the model is not finalized this call will create a Promise which
      // should be resolved when the value arrives. Howeever, this value is not
      // going to be set so there should be a timeout.
      const checker = model.getDataProperty("/data/value");

      await model.setDataProperty("value", "foo", "tree");
      const newValue = await Promise.race([checker, wait(30, "timeout")]);
      assert.equal(newValue, "timeout");
    });
  });

  describe("which is finalized", () => {
    it("handles basic data", async () => {
      const model = new DataModel([
        { version: "0.7" },
        { root: "root" },
        {
          path: "/data",
          contents: {
            value: "tree",
            empty: "",
            num: 30,
          },
        },
      ]);

      model.finalize();

      // Check for known values.
      assert.equal(await model.getDataProperty("/data/value"), "tree");
      assert.equal(await model.getDataProperty("/data/empty"), "");
      assert.equal(await model.getDataProperty("/data/num"), 30);

      // Check for unknown values.
      assert.equal(await model.getDataProperty("/unknown"), null);
    });

    it("returns null for non-existent data", async () => {
      const model = new DataModel([{ version: "0.7" }, { root: "root" }]);
      model.finalize();

      const value = await model.getDataProperty("/data/value");
      assert.equal(value, null);
    });
  });
});
