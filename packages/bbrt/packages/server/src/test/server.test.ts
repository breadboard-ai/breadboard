/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';

void test('synchronous passing test', async (t) => {
  assert.strictEqual(1, 1);

  await t.test('subtest 1', () => {
    assert.strictEqual(2, 2);
  });
});
