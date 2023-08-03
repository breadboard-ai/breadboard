/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { IdVendor } from "../src/id.js";

test("IdVendor vends unique ids", (t) => {
  const vendor = new IdVendor();
  const o1 = {};
  const o2 = {};
  const id1 = vendor.vendId(o1, "test");
  const id2 = vendor.vendId(o1, "test");
  const id3 = vendor.vendId(o2, "test");
  const id4 = vendor.vendId(o2, "test");
  t.not(id1, id2);
  t.not(id3, id4);
  t.is(id1, id3);
  t.is(id2, id4);
});

test("IdVendor vends ids with the given prefix", (t) => {
  const vendor = new IdVendor();
  const id = vendor.vendId({}, "test");
  t.assert(id.startsWith("test-"));
});
