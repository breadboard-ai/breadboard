/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { testKit } from "../../helpers/_test-kit.js";

test("simple test", async (t) => {
  const { foo } = await testKit.noop({ foo: "bar" });
  t.is(foo, "bar");
});
