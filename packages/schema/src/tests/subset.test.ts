/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { JSONSchema4 } from "json-schema";
import * as assert from "node:assert";
import { test, describe } from "node:test";
import { isSubset } from "../subset.js";

function ok(testName: string, a: JSONSchema4, b: JSONSchema4) {
  test(testName, () => assert.equal(isSubset(a, b).subset, true));
}

function notOk(testName: string, a: JSONSchema4, b: JSONSchema4) {
  test(testName, () => assert.equal(isSubset(a, b).subset, false));
}

const EXHAUSTIVE_SCHEMA: JSONSchema4 = {
  type: ["string", "number", "integer", "object", "array", "boolean", "null"],
};

describe("type", () => {
  ok("string vs string", { type: "string" }, { type: "string" });
  ok("string vs [string]", { type: "string" }, { type: ["string"] });
  ok(
    "string vs [number, string]",
    { type: "string" },
    { type: ["number", "string"] }
  );
  ok("string vs missing", { type: "string" }, {});
  ok("missing vs missing", {}, {});
  ok("exhaustive vs exhaustive", EXHAUSTIVE_SCHEMA, EXHAUSTIVE_SCHEMA);
  ok("exhaustive vs missing", EXHAUSTIVE_SCHEMA, {});
  ok(
    "missing vs exhaustive",
    {},
    {
      type: [
        "string",
        "number",
        "integer",
        "object",
        "array",
        "boolean",
        "null",
      ],
    }
  );

  notOk("string vs number", { type: "string" }, { type: "number" });
  notOk("number vs string", { type: "number" }, { type: "string" });
  notOk("string vs [number]", { type: "string" }, { type: ["number"] });
  notOk("[string] vs number", { type: ["string"] }, { type: "number" });
  notOk(
    "[number, string] vs string",
    { type: ["number", "string"] },
    { type: "string" }
  );
  notOk("missing vs string", {}, { type: "string" });
  notOk("object vs array", { type: "object" }, { type: "array" });

  // Note type=number vs type=integer is an interesting case, but that's tested
  // in the "number" suite later.
});

describe("string", () => {
  describe("length", () => {
    ok(
      "equal",
      { type: "string", minLength: 3, maxLength: 6 },
      { type: "string", minLength: 3, maxLength: 6 }
    );
    ok(
      "inside left",
      { type: "string", minLength: 4, maxLength: 6 },
      { type: "string", minLength: 3, maxLength: 6 }
    );
    ok(
      "inside right",
      { type: "string", minLength: 3, maxLength: 5 },
      { type: "string", minLength: 3, maxLength: 6 }
    );
    ok(
      "inside both",
      { type: "string", minLength: 4, maxLength: 5 },
      { type: "string", minLength: 3, maxLength: 6 }
    );

    notOk(
      "outside left",
      { type: "string", minLength: 2, maxLength: 6 },
      { type: "string", minLength: 3, maxLength: 6 }
    );
    notOk(
      "outside right",
      { type: "string", minLength: 3, maxLength: 7 },
      { type: "string", minLength: 3, maxLength: 6 }
    );
    notOk(
      "outside both",
      { type: "string", minLength: 2, maxLength: 7 },
      { type: "string", minLength: 3, maxLength: 6 }
    );

    ok("both missing", { type: "string" }, { type: "string" });
    ok(
      "b missing",
      { type: "string", minLength: 2, maxLength: 7 },
      { type: "string" }
    );
    notOk(
      "a missing",
      { type: "string" },
      { type: "string", minLength: 2, maxLength: 7 }
    );
  });

  describe("pattern", () => {
    ok(
      "equal",
      { type: "string", pattern: "[0-9]+" },
      { type: "string", pattern: "[0-9]+" }
    );
    notOk(
      "not equal",
      { type: "string", pattern: "[0-9]+" },
      { type: "string", pattern: "[a-z]+" }
    );

    ok("both missing", { type: "string" }, { type: "string" });
    ok("b missing", { type: "string", pattern: "[0-9]+" }, { type: "string" });
    notOk(
      "a missing",
      { type: "string" },
      { type: "string", pattern: "[a-z]+" }
    );
  });

  describe("format", () => {
    ok(
      "equal",
      { type: "string", format: "uri" },
      { type: "string", format: "uri" }
    );
    notOk(
      "not equal",
      { type: "string", format: "uri" },
      { type: "string", format: "email" }
    );

    ok("both missing", { type: "string" }, { type: "string" });
    ok("b missing", { type: "string", format: "uri" }, { type: "string" });
    notOk("a missing", { type: "string" }, { type: "string", format: "email" });
  });
});

describe("number", () => {
  describe("number/integer", () => {
    ok("number vs number", { type: "number" }, { type: "number" });
    ok("integer vs number", { type: "integer" }, { type: "number" });
    notOk("number vs integer", { type: "number" }, { type: "integer" });
  });

  describe("inclusive range", () => {
    ok(
      "equal",
      { type: "number", minimum: 3, maximum: 6 },
      { type: "number", minimum: 3, maximum: 6 }
    );
    ok(
      "inside left",
      { type: "number", minimum: 4, maximum: 6 },
      { type: "number", minimum: 3, maximum: 6 }
    );
    ok(
      "inside right",
      { type: "number", minimum: 3, maximum: 5 },
      { type: "number", minimum: 3, maximum: 6 }
    );
    ok(
      "inside both",
      { type: "number", minimum: 4, maximum: 5 },
      { type: "number", minimum: 3, maximum: 6 }
    );
    notOk(
      "outside left",
      { type: "number", minimum: 2, maximum: 6 },
      { type: "number", minimum: 3, maximum: 6 }
    );
    notOk(
      "outside right",
      { type: "number", minimum: 3, maximum: 7 },
      { type: "number", minimum: 3, maximum: 6 }
    );
    notOk(
      "outside both",
      { type: "number", minimum: 2, maximum: 7 },
      { type: "number", minimum: 3, maximum: 6 }
    );
    ok("both missing", { type: "number" }, { type: "number" });
    ok(
      "b missing",
      { type: "number", minimum: 2, maximum: 7 },
      { type: "number" }
    );
    notOk(
      "a missing",
      { type: "number" },
      { type: "number", minimum: 2, maximum: 7 }
    );
  });

  describe("exclusive range", () => {
    // TODO(aomarks) Implement this.
  });

  describe("multipleOf", () => {
    // TODO(aomarks) Implement this.
  });
});

describe("array", () => {
  describe("items.type", () => {
    ok(
      "string vs string",
      { type: "array", items: { type: "string" } },
      { type: "array", items: { type: "string" } }
    );
    notOk(
      "string vs number",
      { type: "array", items: { type: "string" } },
      { type: "array", items: { type: "number" } }
    );
    notOk(
      "number vs string",
      { type: "array", items: { type: "number" } },
      { type: "array", items: { type: "string" } }
    );

    ok(
      "string[] vs string[]",
      { type: "array", items: { type: "array", items: { type: "string" } } },
      { type: "array", items: { type: "array", items: { type: "string" } } }
    );
    ok(
      "string[][] vs string[][]",
      {
        type: "array",
        items: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
        },
      },
      {
        type: "array",
        items: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
        },
      }
    );
    notOk(
      "string[] vs number[]",
      { type: "array", items: { type: "array", items: { type: "string" } } },
      { type: "array", items: { type: "array", items: { type: "number" } } }
    );
    notOk(
      "number[] vs string[]",
      { type: "array", items: { type: "array", items: { type: "number" } } },
      { type: "array", items: { type: "array", items: { type: "string" } } }
    );
    notOk(
      "string[] vs string[][]",
      { type: "array", items: { type: "array", items: { type: "string" } } },
      {
        type: "array",
        items: {
          type: "array",
          items: { type: "array", items: { type: "string" } },
        },
      }
    );
    notOk(
      "string[4] vs string[3]",
      {
        type: "array",
        items: { type: "array", items: { type: "string", maxLength: 4 } },
      },
      {
        type: "array",
        items: { type: "array", items: { type: "string", maxLength: 3 } },
      }
    );

    ok("missing vs missing", { type: "array" }, { type: "array" });
    ok(
      "string vs missing",
      { type: "array", items: { type: "string" } },
      { type: "array" }
    );

    ok(
      "string vs any",
      { type: "array", items: { type: "string" } },
      {
        type: "array",
        items: {
          type: [
            "string",
            "number",
            "integer",
            "object",
            "array",
            "boolean",
            "null",
          ],
        },
      }
    );
    ok(
      "missing vs exhaustive",
      { type: "array" },
      {
        type: "array",
        items: EXHAUSTIVE_SCHEMA,
      }
    );
    ok(
      "exhaustive vs missing",
      {
        type: "array",
        items: EXHAUSTIVE_SCHEMA,
      },
      { type: "array" }
    );
    notOk(
      "missing vs string",
      { type: "array" },
      { type: "array", items: { type: "number" } }
    );
  });
});

describe("object", () => {
  describe("properties", () => {
    ok(
      "string vs string",
      { type: "object", properties: { foo: { type: "string" } } },
      { type: "object", properties: { foo: { type: "string" } } }
    );
    notOk(
      "string vs number",
      { type: "object", properties: { foo: { type: "string" } } },
      { type: "object", properties: { foo: { type: "number" } } }
    );
    notOk(
      "number vs string",
      { type: "object", properties: { foo: { type: "number" } } },
      { type: "object", properties: { foo: { type: "string" } } }
    );

    ok(
      "string<3> vs string<4>",
      { type: "object", properties: { foo: { type: "string", maxLength: 3 } } },
      { type: "object", properties: { foo: { type: "string", maxLength: 4 } } }
    );
    notOk(
      "string<4> vs string<3>",
      { type: "object", properties: { foo: { type: "string", maxLength: 4 } } },
      { type: "object", properties: { foo: { type: "string", maxLength: 3 } } }
    );

    ok(
      "string vs missing",
      { type: "object", properties: { foo: { type: "string" } } },
      { type: "object" }
    );
    ok(
      "missing vs string",
      { type: "object" },
      { type: "object", properties: { foo: { type: "string" } } }
    );
  });

  describe("additionalProperties", () => {
    describe("no properties", () => {
      ok(
        "false vs false",
        { type: "object", additionalProperties: false },
        { type: "object", additionalProperties: false }
      );
      ok(
        "true vs true",
        { type: "object", additionalProperties: true },
        { type: "object", additionalProperties: true }
      );
      ok(
        "false vs true",
        { type: "object", additionalProperties: false },
        { type: "object", additionalProperties: true }
      );
      notOk(
        "true vs false",
        { type: "object", additionalProperties: true },
        { type: "object", additionalProperties: false }
      );
    });

    describe("both false", () => {
      ok(
        "{} vs {}",
        {
          type: "object",
          additionalProperties: false,
        },
        {
          type: "object",
          additionalProperties: false,
        }
      );

      notOk(
        "{foo} vs {}",
        {
          type: "object",
          additionalProperties: false,
          properties: { foo: { type: "string" } },
        },
        {
          type: "object",
          additionalProperties: false,
        }
      );

      ok(
        "{} vs {foo}",
        {
          type: "object",
          additionalProperties: false,
        },
        {
          type: "object",
          additionalProperties: false,
          properties: { foo: { type: "string" } },
        }
      );

      ok(
        "{foo} vs {foo}",
        {
          type: "object",
          additionalProperties: false,
          properties: { foo: { type: "string" } },
        },
        {
          type: "object",
          additionalProperties: false,
          properties: { foo: { type: "string" } },
        }
      );

      notOk(
        "{foo} vs {bar}",
        {
          type: "object",
          additionalProperties: false,
          properties: { foo: { type: "string" } },
        },
        {
          type: "object",
          additionalProperties: false,
          properties: { bar: { type: "string" } },
        }
      );

      notOk(
        "{foo,bar} vs {foo}",
        {
          type: "object",
          additionalProperties: false,
          properties: {
            foo: { type: "string" },
            bar: { type: "string" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          properties: { foo: { type: "string" } },
        }
      );

      ok(
        "{foo} vs {foo,bar}",
        {
          type: "object",
          additionalProperties: false,
          properties: {
            foo: { type: "string" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            foo: { type: "string" },
            bar: { type: "string" },
          },
        }
      );
    });
  });

  describe("requiredProperties", () => {
    ok(
      "{} vs {}",
      { type: "object", required: [] },
      { type: "object", required: [] }
    );
    ok(
      "{foo} vs {foo}",
      { type: "object", required: ["foo"] },
      { type: "object", required: ["foo"] }
    );
    ok(
      "{foo} vs {}",
      { type: "object", required: ["foo"] },
      { type: "object", required: [] }
    );
    ok(
      "{foo,bar} vs {foo}",
      { type: "object", required: ["foo", "bar"] },
      { type: "object", required: ["bar"] }
    );
    notOk(
      "{} vs {foo}",
      { type: "object", required: [] },
      { type: "object", required: ["foo"] }
    );
    notOk(
      "{foo} vs {bar}",
      { type: "object", required: ["foo"] },
      { type: "object", required: ["bar"] }
    );
    notOk(
      "{foo} vs {foo,bar}",
      { type: "object", required: ["foo"] },
      { type: "object", required: ["foo", "bar"] }
    );
  });
});
