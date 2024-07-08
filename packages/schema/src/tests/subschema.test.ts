/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type JSONSchema4 } from "json-schema";
import * as assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  analyzeIsJsonSubSchema,
  type JsonSubSchemaAnalysisDetail,
} from "../subschema.js";

function ok(testName: string, a: JSONSchema4, b: JSONSchema4) {
  test(testName, () => {
    assert.equal(analyzeIsJsonSubSchema(a, b).isSubSchema, true);
  });
}

function notOk(testName: string, a: JSONSchema4, b: JSONSchema4) {
  test(testName, () => {
    assert.equal(analyzeIsJsonSubSchema(a, b).isSubSchema, false);
  });
}

function detail(
  testName: string,
  a: JSONSchema4,
  b: JSONSchema4,
  expectedDetails: JsonSubSchemaAnalysisDetail[] | undefined
) {
  test(testName, () => {
    assert.deepEqual(analyzeIsJsonSubSchema(a, b).details, expectedDetails);
  });
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
    describe("without properties", () => {
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
      ok(
        "{str} vs true",
        { type: "object", additionalProperties: { type: "string" } },
        { type: "object", additionalProperties: true }
      );
      ok(
        "false vs false",
        { type: "object", additionalProperties: false },
        { type: "object", additionalProperties: false }
      );
      ok(
        "false vs {str}",
        { type: "object", additionalProperties: false },
        { type: "object", additionalProperties: { type: "string" } }
      );
      ok(
        "false vs {}",
        { type: "object", additionalProperties: false },
        { type: "object", additionalProperties: {} }
      );
      notOk(
        "{str} vs false",
        { type: "object", additionalProperties: { type: "string" } },
        { type: "object", additionalProperties: false }
      );
      notOk(
        "true vs false",
        { type: "object", additionalProperties: true },
        { type: "object", additionalProperties: false }
      );
      ok(
        "true vs {}",
        { type: "object", additionalProperties: true },
        { type: "object", additionalProperties: {} }
      );
      notOk(
        "true vs {str}",
        { type: "object", additionalProperties: true },
        { type: "object", additionalProperties: { type: "string" } }
      );
      ok(
        "{} vs {}",
        { type: "object", additionalProperties: {} },
        { type: "object", additionalProperties: {} }
      );
      ok(
        "{str} vs {str}",
        { type: "object", additionalProperties: { type: "string" } },
        { type: "object", additionalProperties: { type: "string" } }
      );
      ok(
        "{str} vs {}",
        { type: "object", additionalProperties: { type: "string" } },
        { type: "object", additionalProperties: {} }
      );
      notOk(
        "{} vs {str}",
        { type: "object", additionalProperties: {} },
        { type: "object", additionalProperties: { type: "string" } }
      );
    });

    describe("with properties", () => {});
    notOk(
      "a:false/p:{foo} vs a:false/p:-",
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

describe("enum", () => {
  ok("[foo] vs [foo]", { enum: ["foo"] }, { enum: ["foo"] });
  ok("[42] vs [42]", { enum: [42] }, { enum: [42] });
  ok("[foo] vs [foo, 42]", { enum: ["foo"] }, { enum: ["foo", 42] });
  ok("[] vs []", { enum: [] }, { enum: [] });
  ok("[foo] vs missing", { enum: ["foo"] }, {});

  notOk("[foo, 42] vs [42]", { enum: ["foo", 42] }, { enum: [42] });
  notOk("[foo] vs [42]", { enum: ["foo"] }, { enum: [42] });
  notOk("[foo] vs []", { enum: ["foo"] }, { enum: [] });
  notOk("[] vs [foo]", { enum: [] }, { enum: ["foo"] });
  notOk("missing vs [foo]", {}, { enum: ["foo"] });
  notOk("['42'] vs [42]", { enum: ["42"] }, { enum: [42] });
});

describe("anyOf", () => {
  describe("with / with", () => {
    ok(
      "[str, num, bool] vs [str, num, bool]",
      { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
      { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] }
    );
    ok(
      "[str, num, bool] vs [bool, str, num]",
      { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
      { anyOf: [{ type: "boolean" }, { type: "string" }, { type: "number" }] }
    );
    ok(
      "[str, num] vs [str, num, bool]",
      { anyOf: [{ type: "string" }, { type: "number" }] },
      { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] }
    );
    ok(
      "[str:email, str:uri]:3 vs [str:email, str:uri]:4",
      {
        maxLength: 3,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      },
      {
        maxLength: 4,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      }
    );
    ok(
      "[str:email:3, str:uri:3] vs [str:email, str:uri]:4",
      {
        anyOf: [
          { type: "string", format: "email", maxLength: 3 },
          { type: "string", format: "uri", maxLength: 3 },
        ],
      },
      {
        maxLength: 4,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      }
    );
    ok(
      "[] vs [str, num]",
      { anyOf: [] },
      { anyOf: [{ type: "string" }, { type: "number" }] }
    );
    ok(
      "anyOf[str, num] vs type[str, num]",
      {
        anyOf: [{ type: "string" }, { type: "number" }],
      },
      {
        type: ["string", "number"],
      }
    );

    notOk(
      "[str, num, bool] vs [str, num]",
      { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
      { anyOf: [{ type: "string" }, { type: "number" }] }
    );
    notOk(
      "[str:email, str:uri]:4 vs [str:email, str:uri]:3",
      {
        maxLength: 4,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      },
      {
        maxLength: 3,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      }
    );
    notOk(
      "[str, num] vs []",
      { anyOf: [{ type: "string" }, { type: "number" }] },
      { anyOf: [] }
    );
    notOk(
      "anyOf[str, bool] vs type[str, num]",
      {
        anyOf: [{ type: "string" }, { type: "boolean" }],
      },
      {
        type: ["string", "number"],
      }
    );
  });

  describe("with / without", () => {
    ok(
      "[str:email, str:uri] vs str",
      {
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      },
      { type: "string" }
    );
    ok(
      "[str, num] vs empty",
      { anyOf: [{ type: "string" }, { type: "number" }] },
      {}
    );
    ok(
      "[str:email, str:uri]:3 vs str:4",
      {
        maxLength: 3,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      },
      { type: "string", maxLength: 4 }
    );
    notOk(
      "[str, num] vs bool",
      { anyOf: [{ type: "string" }, { type: "number" }] },
      { type: "boolean" }
    );
    notOk(
      "[str, num] vs str",
      { anyOf: [{ type: "string" }, { type: "number" }] },
      { type: "string" }
    );
    notOk(
      "[str:email, str:uri] vs str:date",
      {
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      },
      { type: "string", format: "date" }
    );
    notOk(
      "[str:email, str:uri]:4 vs str:3",
      {
        maxLength: 4,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      },
      { type: "string", maxLength: 3 }
    );
  });

  describe("without / with", () => {
    ok(
      "str vs [str, num]",
      { type: "string" },
      { anyOf: [{ type: "string" }, { type: "number" }] }
    );
    ok(
      "anyOf[str, num] vs type[str, num]",
      { anyOf: [{ type: "string" }, { type: "number" }] },
      { type: ["string", "number"] }
    );

    notOk(
      "bool vs [str, num]",
      { type: "boolean" },
      { anyOf: [{ type: "string" }, { type: "number" }] }
    );
    notOk(
      "str vs [str:email, str:uri]",
      { type: "string" },
      {
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      }
    );
    notOk(
      "empty vs [str, num]",
      {},
      { anyOf: [{ type: "string" }, { type: "number" }] }
    );
    notOk(
      "string vs [str]:3",
      { type: "string" },
      {
        maxLength: 3,
        anyOf: [{ type: "string" }],
      }
    );
    notOk(
      "type[str, num] vs anyOf[str, bool]",
      { type: ["string", "number"] },
      { anyOf: [{ type: "string" }, { type: "boolean" }] }
    );
  });
});

describe("details", () => {
  detail("type", { type: "string" }, { type: "number" }, [
    { pathA: ["type"], pathB: ["type"] },
  ]);

  describe("string", () => {
    detail(
      "pattern",
      { type: "string", pattern: "[0-9]+" },
      { type: "string", pattern: "[a-z]+" },
      [{ pathA: ["pattern"], pathB: ["pattern"] }]
    );
    detail(
      "format",
      { type: "string", format: "email" },
      { type: "string", format: "uri" },
      [{ pathA: ["format"], pathB: ["format"] }]
    );
    detail(
      "length",
      { type: "string", minLength: 2, maxLength: 5 },
      { type: "string", minLength: 3, maxLength: 4 },
      [
        { pathA: ["minLength"], pathB: ["minLength"] },
        { pathA: ["maxLength"], pathB: ["maxLength"] },
      ]
    );
  });

  describe("number", () => {
    detail(
      "minimum",
      { type: "number", minimum: 3 },
      { type: "number", minimum: 4 },
      [{ pathA: ["minimum"], pathB: ["minimum"] }]
    );
    detail(
      "maximum",
      { type: "number", maximum: 4 },
      { type: "number", maximum: 3 },
      [{ pathA: ["maximum"], pathB: ["maximum"] }]
    );
  });

  detail("enum", { enum: ["foo"] }, { enum: [42] }, [
    { pathA: ["enum"], pathB: ["enum"] },
  ]);

  describe("array", () => {
    detail(
      "items.type",
      { type: "array", items: { type: "string" } },
      { type: "array", items: { type: "number" } },
      [{ pathA: ["items", "type"], pathB: ["items", "type"] }]
    );
  });

  describe("object", () => {
    detail(
      "properties",
      { type: "object", properties: { foo: { type: "string" } } },
      { type: "object", properties: { foo: { type: "number" } } },
      [
        {
          pathA: ["properties", "foo", "type"],
          pathB: ["properties", "foo", "type"],
        },
      ]
    );

    detail(
      "additionalProperties (setting)",
      { type: "object" },
      { type: "object", additionalProperties: false },
      [
        {
          pathA: ["additionalProperties"],
          pathB: ["additionalProperties"],
        },
      ]
    );

    detail(
      "additionalProperties (extra property)",
      {
        type: "object",
        additionalProperties: false,
        properties: { foo: { type: "string" } },
      },
      {
        type: "object",
        additionalProperties: false,
      },
      [
        {
          pathA: ["properties", "foo"],
          pathB: ["additionalProperties"],
        },
      ]
    );

    detail(
      "requiredProperties",
      {
        type: "object",
        required: ["foo", "baz"],
      },
      {
        type: "object",
        required: ["foo", "bar", "baz", "qux"],
      },
      [
        {
          pathA: ["required"],
          pathB: ["required", 1],
        },
        {
          pathA: ["required"],
          pathB: ["required", 3],
        },
      ]
    );
  });

  describe("anyOf", () => {
    detail(
      "with/with",
      { anyOf: [{ type: "string" }, { type: "boolean" }, { type: "number" }] },
      { anyOf: [{ type: "string" }, { type: "number" }] },
      [{ pathA: ["anyOf", 1], pathB: ["anyOf"] }]
    );
    detail(
      "with/without",
      { anyOf: [{ type: "string" }, { type: "number" }] },
      { type: "string" },
      [{ pathA: ["anyOf", 1, "type"], pathB: ["type"] }]
    );
    detail(
      "with/without (inherited constraint)",
      {
        maxLength: 4,
        anyOf: [
          { type: "string", format: "email" },
          { type: "string", format: "uri" },
        ],
      },
      { type: "string", maxLength: 3 },
      [{ pathA: ["maxLength"], pathB: ["maxLength"] }]
    );
    detail(
      "with/without (own constraint)",
      {
        anyOf: [
          { type: "string", format: "email", maxLength: 4 },
          { type: "string", format: "uri", maxLength: 4 },
        ],
      },
      { type: "string", maxLength: 3 },
      [{ pathA: ["anyOf", 0, "maxLength"], pathB: ["maxLength"] }]
    );
    detail(
      "without/with",
      { type: "boolean" },
      { anyOf: [{ type: "string" }, { type: "number" }] },
      [{ pathA: [], pathB: ["anyOf"] }]
    );
  });
});
