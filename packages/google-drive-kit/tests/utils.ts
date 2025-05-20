import test from "ava";

import { truncateValueForUtf8 } from "../../src/utils.js";

test("truncateValueForUtf8", (t) => {
  t.deepEqual(truncateValueForUtf8("key", "", 4), "");
  t.deepEqual(truncateValueForUtf8("key", "value", 7), "valu");
  t.deepEqual(truncateValueForUtf8("key", "value", 5), "va");
  t.deepEqual(truncateValueForUtf8("key", "value", 8), "value");
  // "Ї" needs 2 bytes.
  t.deepEqual(truncateValueForUtf8("key", "aЇa", 6), "aЇ");
  t.deepEqual(truncateValueForUtf8("key", "aࠉa", 6), "a");
  t.deepEqual(truncateValueForUtf8("key", "aЇa", 7), "aЇa");
  t.deepEqual(truncateValueForUtf8("key", "aЇa", 8), "aЇa");
  // "ࠉ" needs 3 bytes.
  t.deepEqual(truncateValueForUtf8("key", "aࠉa", 9), "aࠉa");
  t.deepEqual(truncateValueForUtf8("key", "aࠉa", 10), "aࠉa");
});
