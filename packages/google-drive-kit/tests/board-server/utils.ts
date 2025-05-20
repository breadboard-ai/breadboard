import { describe, it } from "node:test";
import { equal } from "node:assert";

import { truncateValueForUtf8 } from "../../src/board-server/utils.js";

describe("truncateValueForUtf8", () => {
  it("truncates if needed", () => {
    equal(truncateValueForUtf8("key", "", 4), "");
    equal(truncateValueForUtf8("key", "value", 7), "valu");
    equal(truncateValueForUtf8("key", "value", 5), "va");
    equal(truncateValueForUtf8("key", "value", 8), "value");
    // "Ї" needs 2 bytes.
    equal(truncateValueForUtf8("key", "aЇa", 6), "aЇ");
    equal(truncateValueForUtf8("key", "aࠉa", 6), "a");
    equal(truncateValueForUtf8("key", "aЇa", 7), "aЇa");
    equal(truncateValueForUtf8("key", "aЇa", 8), "aЇa");
    // "ࠉ" needs 3 bytes.
    equal(truncateValueForUtf8("key", "aࠉa", 9), "aࠉa");
    equal(truncateValueForUtf8("key", "aࠉa", 10), "aࠉa");
  });
});
